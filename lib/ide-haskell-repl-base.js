"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
const AtomTypes = require("atom");
const path_1 = require("path");
const util_1 = require("./util");
async function readCabalFile(cabalFile) {
    const cabalContents = await cabalFile.read();
    if (cabalContents === null)
        return undefined;
    const noTabs = cabalContents.replace(/\t/g, '        ');
    if (noTabs !== cabalContents) {
        atom.notifications.addWarning('Tabs found in Cabalfile, replacing with 8 spaces', {
            detail: 'Tabs are not allowed as indentation characters in Cabalfiles due to ' +
                'a missing standard interpretation of tab width. Tabs have been ' +
                'automatically replaced by 8 spaces as per Haskell report standard, ' +
                'but it is advised to avoid using tabulation in Cabalfile.',
            dismissable: true,
        });
    }
    return noTabs;
}
async function getCabalFile(rootDir) {
    const cont = await new Promise((resolve, reject) => rootDir.getEntries((error, contents) => {
        if (error) {
            reject(error);
        }
        else {
            resolve(contents);
        }
    }));
    return cont.filter((file) => file.isFile() && file.getBaseName().endsWith('.cabal'));
}
async function parseCabalFile(cabalFile, cwd, uri) {
    const cabalContents = await readCabalFile(cabalFile);
    if (cabalContents === undefined)
        return {};
    const cabal = await Util.parseDotCabal(cabalContents);
    let comps;
    if (uri !== undefined) {
        comps = await Util.getComponentFromFile(cabalContents, cwd.relativize(uri));
    }
    return { cabal: cabal === null ? undefined : cabal, comps };
}
class IdeHaskellReplBase {
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }, errorSrouce) {
        this.errorSrouce = errorSrouce;
        this.prompt = '';
        this.errors = [];
        this.emitter = new AtomTypes.Emitter();
        this.parseMessage = (raw) => {
            if (!this.cwd) {
                return undefined;
            }
            const matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?[ \t]*(\[[^\]]+\])?[ \t]*\n?([^]*)/;
            if (raw && raw.trim() !== '') {
                const matched = raw.match(matchLoc);
                if (matched) {
                    const [filec, line, col, rawTyp, context, msg] = matched.slice(1);
                    let typ = rawTyp ? rawTyp.toLowerCase() : 'error';
                    let file;
                    if (filec === '<interactive>') {
                        file = undefined;
                        typ = 'repl';
                    }
                    else {
                        file = filec;
                    }
                    return {
                        uri: file
                            ? path_1.isAbsolute(file)
                                ? path_1.normalize(file)
                                : this.cwd.getFile(file).getPath()
                            : undefined,
                        position: [
                            parseInt(line, 10) - 1,
                            parseInt(col, 10) - 1,
                        ],
                        message: {
                            text: this.unindentMessage(msg.trimRight()),
                            highlighter: 'hint.message.haskell',
                        },
                        context,
                        severity: typ,
                        _time: Date.now(),
                    };
                }
                else {
                    return {
                        message: raw,
                        severity: 'repl',
                        _time: Date.now(),
                    };
                }
            }
            else {
                return undefined;
            }
        };
        this.uri = uri || '';
        this.history = new command_history_1.CommandHistory(history);
        this._autoReloadRepeat = !!autoReloadRepeat;
        this.messages = content || [];
        this.readyPromise = this.initialize(upiPromise);
    }
    static async getRootDir(uri) {
        return Util.getRootDir(uri);
    }
    static async componentFromURI(uri) {
        const cwd = await IdeHaskellReplBase.getRootDir(uri);
        const [cabalFile] = await getCabalFile(cwd);
        let comp;
        let cabal;
        if (cabalFile) {
            const parsed = await parseCabalFile(cabalFile, cwd, cwd.relativize(uri));
            if (parsed.comps)
                comp = parsed.comps[0];
            if (parsed.cabal)
                cabal = parsed.cabal;
        }
        return { cwd, comp, cabal };
    }
    onDidDestroy(callback) {
        return this.emitter.on('destroyed', callback);
    }
    toggleAutoReloadRepeat() {
        this.autoReloadRepeat = !this.autoReloadRepeat;
    }
    async runCommand(command) {
        if (!this.ghci) {
            throw new Error('No GHCI instance!');
        }
        const inp = command.split('\n');
        const res = await this.ghci.writeLines(inp, (lineInfo) => {
            switch (lineInfo.type) {
                case 'stdin':
                    lineInfo.line &&
                        this.messages.push({
                            text: inp.join('\n'),
                            hl: true,
                            cls: 'ide-haskell-repl-input-text',
                        });
                    break;
                case 'stdout':
                    lineInfo.line &&
                        this.messages.push({
                            text: lineInfo.line,
                            hl: true,
                            cls: 'ide-haskell-repl-output-text',
                        });
                    break;
                case 'prompt':
                    this.prompt = lineInfo.prompt[1];
                    break;
                default:
                    break;
            }
            this.update();
        });
        this.update();
        if (command.trim().startsWith(':l'))
            await this.onLoad();
        else if (command.trim().startsWith(':r'))
            await this.onReload();
        else if (command.trim().startsWith(':e'))
            await this.onReload();
        this.errorsFromStderr(res.stderr);
        return res;
    }
    async ghciReload() {
        if (!this.ghci) {
            throw new Error('No GHCI instance!');
        }
        const { prompt, stderr } = await this.ghci.reload();
        this.prompt = prompt[1];
        this.update();
        await this.onReload();
        return !this.errorsFromStderr(stderr);
    }
    async ghciReloadRepeat() {
        if (await this.ghciReload()) {
            const command = this.history.peek(-1);
            if (command) {
                return this.runCommand(command);
            }
        }
        return undefined;
    }
    set autoReloadRepeat(autoReloadRepeat) {
        this._autoReloadRepeat = autoReloadRepeat;
        this.update();
    }
    get autoReloadRepeat() {
        return this._autoReloadRepeat;
    }
    interrupt() {
        if (!this.ghci) {
            throw new Error('No GHCI instance!');
        }
        this.ghci.interrupt();
    }
    async getCompletions(prefix) {
        if (!prefix.trim()) {
            return [];
        }
        if (!this.ghci) {
            throw new Error('No GHCI instance!');
        }
        const res = await this.ghci.sendCompletionRequest();
        if (!res)
            return undefined;
        res.stdout.shift();
        return fuzzaldrin_1.filter(res.stdout, prefix).map((text) => ({
            text: text.slice(1, -1),
        }));
    }
    clearErrors() {
        this.setErrors([]);
    }
    async onInitialLoad() {
        return this.onLoad();
    }
    async onReload() {
        return this.onLoad();
    }
    async onLoad() {
        return this.clearErrors();
    }
    async destroy() {
        this.emitter.emit('destroyed');
        this.clearErrors();
        if (this.ghci) {
            this.ghci.destroy();
        }
    }
    async initialize(upiPromise) {
        this.upi = await upiPromise;
        if (!this.upi) {
            return this.runREPL();
        }
        try {
            const builder = await this.upi.getBuilder();
            return await this.runREPL(builder && builder.name);
        }
        catch (e) {
            const error = e;
            if (error) {
                atom.notifications.addFatalError(error.toString(), {
                    detail: error.toString(),
                    dismissable: true,
                    stack: error.stack,
                });
            }
            atom.notifications.addWarning("ide-haskell-repl: Couldn't get builder. Falling back to default REPL", {
                dismissable: true,
            });
            return this.runREPL();
        }
    }
    async runREPL(inbuilder) {
        const builder = inbuilder || atom.config.get('ide-haskell-repl.defaultRepl');
        if (!builder)
            throw new Error(`Default REPL not specified`);
        const { cwd, comp, cabal } = await IdeHaskellReplBase.componentFromURI(this.uri);
        this.cwd = cwd;
        let commandPath;
        let commandArgs;
        let extraArgs;
        switch (builder) {
            case 'cabal-v1':
                commandPath = atom.config.get('ide-haskell-repl.cabalPath');
                commandArgs = atom.config.get('ide-haskell-repl').legacyCabalV1
                    ? ['repl']
                    : ['v1-repl'];
                extraArgs = (x) => `--ghc-option=${x}`;
                break;
            case 'cabal-v2':
                commandPath = atom.config.get('ide-haskell-repl.cabalPath');
                commandArgs = ['v2-repl'];
                extraArgs = (x) => `--ghc-option=${x}`;
                break;
            case 'stack':
                commandPath = atom.config.get('ide-haskell-repl.stackPath');
                commandArgs = ['ghci'];
                extraArgs = (x) => `--ghci-options="${x}"`;
                break;
            case 'ghci':
            case 'none':
                commandPath = atom.config.get('ide-haskell-repl.ghciPath');
                commandArgs = [];
                extraArgs = (x) => x;
                break;
            default:
                throw new Error(`Unknown builder ${builder}`);
        }
        const extraArgsList = atom.config.get('ide-haskell-repl.extraArgs') || [];
        commandArgs.push(...extraArgsList.map(extraArgs));
        if (comp && cabal) {
            if (builder === 'stack') {
                const compc = comp.startsWith('lib:') ? 'lib' : comp;
                commandArgs.push(`${cabal.name}:${compc}`);
            }
            else {
                commandArgs.push(comp);
            }
        }
        this.ghci = new ghci_1.GHCI({
            atomPath: process.execPath,
            command: commandPath,
            args: commandArgs,
            cwd: this.cwd.getPath(),
            onExit: async () => this.destroy(),
        });
        const initres = await this.ghci.waitReady();
        this.prompt = initres.prompt[1];
        await this.onInitialLoad();
        this.errorsFromStderr(initres.stderr, true);
        return this.update();
    }
    errorsFromStderr(stderr, filterInitWarnings = false) {
        const noInitWarnings = filterInitWarnings
            ? (x) => x !== undefined &&
                !(x.severity === 'repl' &&
                    util_1.getText(x.message).match(/^Some flags have not been recognized: (?:(?:prompt2|prompt-cont),\s*)+\s*/))
            : (x) => x !== undefined;
        return this.appendErrors(stderr
            .filter((x) => !/^\s*\d* \|/.test(x))
            .join('\n')
            .split(/\n(?=\S)/)
            .map(this.parseMessage)
            .filter(noInitWarnings));
    }
    unindentMessage(message) {
        let lines = message.split('\n').filter((x) => !x.match(/^\s*$/));
        let minIndent;
        for (const line of lines) {
            const match = line.match(/^\s*/);
            if (match) {
                const lineIndent = match[0].length;
                if (!minIndent || lineIndent < minIndent) {
                    minIndent = lineIndent;
                }
            }
        }
        if (minIndent !== undefined) {
            const mi = minIndent;
            lines = lines.map((line) => line.slice(mi));
        }
        return lines.join('\n');
    }
    appendErrors(errors) {
        let hasErrors = false;
        let newMessages = false;
        let newErrors = false;
        for (const error of errors) {
            const dupIdx = this.errors.findIndex((x) => isSameError(error, x));
            if (dupIdx >= 0) {
                if (this.errors[dupIdx]._time <= error._time) {
                    this.errors[dupIdx]._time = error._time;
                }
            }
            else {
                this.errors.push(error);
            }
            if (error.severity === 'error')
                hasErrors = true;
            if (error.severity === 'repl')
                newMessages = true;
            else
                newErrors = true;
        }
        const errMessages = errors.filter(({ severity }) => severity === 'repl');
        if (atom.config.get('ide-haskell-repl.errorsInOutput')) {
            for (const m of errMessages) {
                this.messages.push({
                    text: util_1.getText(m.message),
                    cls: 'ide-haskell-repl-stderr',
                });
            }
        }
        this.setErrors(this.errors, newErrors, newMessages);
        return hasErrors;
    }
    setErrors(errors, newErrors = true, newMessages = true) {
        this.errors = errors;
        if (this.upi) {
            if (newMessages) {
                this.upi.setMessages(this.errors.filter(({ severity }) => severity === 'repl'));
            }
            if (newErrors) {
                this.upi.setErrors(this.errorSrouce, this.errors.filter(({ severity }) => severity !== 'repl'));
            }
        }
        else {
            if (atom.config.get('ide-haskell-repl.errorsInOutput')) {
                this.errors = this.errors.filter(({ severity }) => severity !== 'repl');
            }
            const now = Date.now();
            this.errors = this.errors.filter((x) => x.uri !== undefined || now - x._time < 3000);
        }
        util_1.handlePromise(this.update());
    }
}
exports.IdeHaskellReplBase = IdeHaskellReplBase;
function isSameError(e1, e2) {
    const sameContext = e1.context === e2.context;
    const samePos = e1.position &&
        e2.position &&
        AtomTypes.Point.fromObject(e1.position).isEqual(e2.position);
    const sameSeverity = e1.severity === e2.severity;
    const sameUri = e1.uri === e2.uri;
    const sameMessage = isSameMessage(e1.message, e2.message);
    return sameContext && samePos && sameSeverity && sameUri && sameMessage;
}
function isSameMessage(m1, m2) {
    if (typeof m1 === 'string' || typeof m2 === 'string') {
        return m1 === m2;
    }
    else if ('html' in m1 && 'html' in m2) {
        return m1.html === m2.html;
    }
    else if ('text' in m1 && 'text' in m2) {
        return m1.text === m2.text && m1.highlighter === m2.highlighter;
    }
    else {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBQzVDLGlDQUErQztBQXVCL0MsS0FBSyxVQUFVLGFBQWEsQ0FDMUIsU0FBeUI7SUFFekIsTUFBTSxhQUFhLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUE7SUFDNUMsSUFBSSxhQUFhLEtBQUssSUFBSTtRQUFFLE9BQU8sU0FBUyxDQUFBO0lBQzVDLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFBO0lBQ3ZELElBQUksTUFBTSxLQUFLLGFBQWEsRUFBRTtRQUM1QixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDM0Isa0RBQWtELEVBQ2xEO1lBQ0UsTUFBTSxFQUNKLHNFQUFzRTtnQkFDdEUsaUVBQWlFO2dCQUNqRSxxRUFBcUU7Z0JBQ3JFLDJEQUEyRDtZQUM3RCxXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUNGLENBQUE7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZLENBQ3pCLE9BQTRCO0lBRTVCLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQzVCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ2xCLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDckMsSUFBSSxLQUFLLEVBQUU7WUFDVCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7U0FDZDthQUFNO1lBQ0wsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1NBQ2xCO0lBQ0gs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V0FBVyxDQUFBO0tBQ2hFO1NBQU07UUFDTCxPQUFPLEtBQUssQ0FBQTtLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAnZnV6emFsZHJpbidcblxuaW1wb3J0IHsgQ29tbWFuZEhpc3RvcnkgfSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7IEdIQ0ksIElSZXF1ZXN0UmVzdWx0IH0gZnJvbSAnLi9naGNpJ1xuaW1wb3J0ICogYXMgVVBJIGZyb20gJ2F0b20taGFza2VsbC11cGknXG5pbXBvcnQgKiBhcyBBdG9tVHlwZXMgZnJvbSAnYXRvbSdcbmltcG9ydCB7IFVQSUNvbnN1bWVyIH0gZnJvbSAnLi91cGlDb25zdW1lcidcbmltcG9ydCB7IGlzQWJzb2x1dGUsIG5vcm1hbGl6ZSB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBoYW5kbGVQcm9taXNlLCBnZXRUZXh0IH0gZnJvbSAnLi91dGlsJ1xuXG5leHBvcnQgeyBJUmVxdWVzdFJlc3VsdCB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdTdGF0ZSB7XG4gIHVyaT86IHN0cmluZ1xuICBoaXN0b3J5Pzogc3RyaW5nW11cbiAgYXV0b1JlbG9hZFJlcGVhdD86IGJvb2xlYW5cbiAgY29udGVudD86IElDb250ZW50SXRlbVtdXG4gIGZvY3VzPzogYm9vbGVhblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbiAgaGxjYWNoZT86IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0gZXh0ZW5kcyBVUEkuSVJlc3VsdEl0ZW0ge1xuICBfdGltZTogbnVtYmVyXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRDYWJhbEZpbGUoXG4gIGNhYmFsRmlsZTogQXRvbVR5cGVzLkZpbGUsXG4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICBpZiAoY2FiYWxDb250ZW50cyA9PT0gbnVsbCkgcmV0dXJuIHVuZGVmaW5lZFxuICBjb25zdCBub1RhYnMgPSBjYWJhbENvbnRlbnRzLnJlcGxhY2UoL1xcdC9nLCAnICAgICAgICAnKVxuICBpZiAobm9UYWJzICE9PSBjYWJhbENvbnRlbnRzKSB7XG4gICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXG4gICAgICAnVGFicyBmb3VuZCBpbiBDYWJhbGZpbGUsIHJlcGxhY2luZyB3aXRoIDggc3BhY2VzJyxcbiAgICAgIHtcbiAgICAgICAgZGV0YWlsOlxuICAgICAgICAgICdUYWJzIGFyZSBub3QgYWxsb3dlZCBhcyBpbmRlbnRhdGlvbiBjaGFyYWN0ZXJzIGluIENhYmFsZmlsZXMgZHVlIHRvICcgK1xuICAgICAgICAgICdhIG1pc3Npbmcgc3RhbmRhcmQgaW50ZXJwcmV0YXRpb24gb2YgdGFiIHdpZHRoLiBUYWJzIGhhdmUgYmVlbiAnICtcbiAgICAgICAgICAnYXV0b21hdGljYWxseSByZXBsYWNlZCBieSA4IHNwYWNlcyBhcyBwZXIgSGFza2VsbCByZXBvcnQgc3RhbmRhcmQsICcgK1xuICAgICAgICAgICdidXQgaXQgaXMgYWR2aXNlZCB0byBhdm9pZCB1c2luZyB0YWJ1bGF0aW9uIGluIENhYmFsZmlsZS4nLFxuICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgKVxuICB9XG4gIHJldHVybiBub1RhYnNcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0Q2FiYWxGaWxlKFxuICByb290RGlyOiBBdG9tVHlwZXMuRGlyZWN0b3J5LFxuKTogUHJvbWlzZTxBdG9tVHlwZXMuRmlsZVtdPiB7XG4gIGNvbnN0IGNvbnQgPSBhd2FpdCBuZXcgUHJvbWlzZTxBcnJheTxBdG9tVHlwZXMuRGlyZWN0b3J5IHwgQXRvbVR5cGVzLkZpbGU+PihcbiAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgcm9vdERpci5nZXRFbnRyaWVzKChlcnJvciwgY29udGVudHMpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoY29udGVudHMpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICApXG4gIHJldHVybiBjb250LmZpbHRlcihcbiAgICAoZmlsZSkgPT4gZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpLFxuICApIGFzIEF0b21UeXBlcy5GaWxlW11cbn1cblxuYXN5bmMgZnVuY3Rpb24gcGFyc2VDYWJhbEZpbGUoXG4gIGNhYmFsRmlsZTogQXRvbVR5cGVzLkZpbGUsXG4gIGN3ZDogQXRvbVR5cGVzLkRpcmVjdG9yeSxcbiAgdXJpOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4pOiBQcm9taXNlPHsgY2FiYWw/OiBVdGlsLklEb3RDYWJhbDsgY29tcHM/OiBzdHJpbmdbXSB9PiB7XG4gIGNvbnN0IGNhYmFsQ29udGVudHMgPSBhd2FpdCByZWFkQ2FiYWxGaWxlKGNhYmFsRmlsZSlcbiAgaWYgKGNhYmFsQ29udGVudHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHt9XG4gIGNvbnN0IGNhYmFsID0gYXdhaXQgVXRpbC5wYXJzZURvdENhYmFsKGNhYmFsQ29udGVudHMpXG4gIGxldCBjb21wczogc3RyaW5nW10gfCB1bmRlZmluZWRcbiAgaWYgKHVyaSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgY29tcHMgPSBhd2FpdCBVdGlsLmdldENvbXBvbmVudEZyb21GaWxlKGNhYmFsQ29udGVudHMsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gIH1cbiAgcmV0dXJuIHsgY2FiYWw6IGNhYmFsID09PSBudWxsID8gdW5kZWZpbmVkIDogY2FiYWwsIGNvbXBzIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHB1YmxpYyByZWFkb25seSByZWFkeVByb21pc2U6IFByb21pc2U8dm9pZD5cbiAgcHJvdGVjdGVkIGdoY2k/OiBHSENJXG4gIHByb3RlY3RlZCBjd2Q/OiBBdG9tVHlwZXMuRGlyZWN0b3J5XG4gIHByb3RlY3RlZCBwcm9tcHQ6IHN0cmluZyA9ICcnXG4gIHByb3RlY3RlZCB1cGk/OiBVUElDb25zdW1lclxuICBwcm90ZWN0ZWQgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByb3RlY3RlZCBlcnJvcnM6IElFcnJvckl0ZW1bXSA9IFtdXG4gIHByb3RlY3RlZCBfYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhblxuICBwcm90ZWN0ZWQgaGlzdG9yeTogQ29tbWFuZEhpc3RvcnlcbiAgcHJvdGVjdGVkIHVyaTogc3RyaW5nXG4gIHByaXZhdGUgZW1pdHRlciA9IG5ldyBBdG9tVHlwZXMuRW1pdHRlcjx7IGRlc3Ryb3llZDogdm9pZCB9PigpXG5cbiAgY29uc3RydWN0b3IoXG4gICAgdXBpUHJvbWlzZTogUHJvbWlzZTxVUElDb25zdW1lciB8IHVuZGVmaW5lZD4sXG4gICAge1xuICAgICAgdXJpLFxuICAgICAgY29udGVudCxcbiAgICAgIGhpc3RvcnksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9OiBJVmlld1N0YXRlLFxuICAgIHByb3RlY3RlZCByZWFkb25seSBlcnJvclNyb3VjZTogc3RyaW5nLFxuICApIHtcbiAgICB0aGlzLnVyaSA9IHVyaSB8fCAnJ1xuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSAhIWF1dG9SZWxvYWRSZXBlYXRcblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IHRoaXMuaW5pdGlhbGl6ZSh1cGlQcm9taXNlKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyKHVyaTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIFV0aWwuZ2V0Um9vdERpcih1cmkpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGNvbXBvbmVudEZyb21VUkkodXJpOiBzdHJpbmcpIHtcbiAgICBjb25zdCBjd2QgPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Um9vdERpcih1cmkpXG4gICAgY29uc3QgW2NhYmFsRmlsZV0gPSBhd2FpdCBnZXRDYWJhbEZpbGUoY3dkKVxuXG4gICAgbGV0IGNvbXA6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgIGxldCBjYWJhbDogVXRpbC5JRG90Q2FiYWwgfCB1bmRlZmluZWRcbiAgICBpZiAoY2FiYWxGaWxlKSB7XG4gICAgICBjb25zdCBwYXJzZWQgPSBhd2FpdCBwYXJzZUNhYmFsRmlsZShjYWJhbEZpbGUsIGN3ZCwgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgICAgIGlmIChwYXJzZWQuY29tcHMpIGNvbXAgPSBwYXJzZWQuY29tcHNbMF1cbiAgICAgIGlmIChwYXJzZWQuY2FiYWwpIGNhYmFsID0gcGFyc2VkLmNhYmFsXG4gICAgfVxuICAgIHJldHVybiB7IGN3ZCwgY29tcCwgY2FiYWwgfVxuICB9XG5cbiAgcHVibGljIGFic3RyYWN0IGFzeW5jIHVwZGF0ZShwcm9wcz86IGFueSk6IFByb21pc2U8dm9pZD5cblxuICBwdWJsaWMgb25EaWREZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZW1pdHRlci5vbignZGVzdHJveWVkJywgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCgpIHtcbiAgICB0aGlzLmF1dG9SZWxvYWRSZXBlYXQgPSAhdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAobGluZUluZm8pID0+IHtcbiAgICAgIHN3aXRjaCAobGluZUluZm8udHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OiBsaW5lSW5mby5saW5lLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSBsaW5lSW5mby5wcm9tcHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgICBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOmwnKSkgYXdhaXQgdGhpcy5vbkxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzpyJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzplJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgeyBwcm9tcHQsIHN0ZGVyciB9ID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5wcm9tcHQgPSBwcm9tcHRbMV1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gICAgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuICF0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQoKSB7XG4gICAgaWYgKGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LnBlZWsoLTEpXG4gICAgICBpZiAoY29tbWFuZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyhwcmVmaXg6IHN0cmluZykge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgaWYgKCFyZXMpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXMuc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHJlcy5zdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe1xuICAgICAgdGV4dDogdGV4dC5zbGljZSgxLCAtMSksXG4gICAgfSkpXG4gIH1cblxuICBwdWJsaWMgY2xlYXJFcnJvcnMoKSB7XG4gICAgdGhpcy5zZXRFcnJvcnMoW10pXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uUmVsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkKCkge1xuICAgIHJldHVybiB0aGlzLmNsZWFyRXJyb3JzKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95KCkge1xuICAgIHRoaXMuZW1pdHRlci5lbWl0KCdkZXN0cm95ZWQnKVxuICAgIHRoaXMuY2xlYXJFcnJvcnMoKVxuICAgIGlmICh0aGlzLmdoY2kpIHtcbiAgICAgIHRoaXMuZ2hjaS5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaW5pdGlhbGl6ZSh1cGlQcm9taXNlOiBQcm9taXNlPFVQSUNvbnN1bWVyIHwgdW5kZWZpbmVkPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiB0aGlzLnJ1blJFUEwoKVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkuZ2V0QnVpbGRlcigpXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5ydW5SRVBMKGJ1aWxkZXIgJiYgYnVpbGRlci5uYW1lKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gZSBhcyBFcnJvclxuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLnRvU3RyaW5nKCksXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXG4gICAgICAgIFwiaWRlLWhhc2tlbGwtcmVwbDogQ291bGRuJ3QgZ2V0IGJ1aWxkZXIuIEZhbGxpbmcgYmFjayB0byBkZWZhdWx0IFJFUExcIixcbiAgICAgICAge1xuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgKVxuICAgICAgcmV0dXJuIHRoaXMucnVuUkVQTCgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJ1blJFUEwoXG4gICAgaW5idWlsZGVyPzogJ2NhYmFsLXYxJyB8ICdzdGFjaycgfCAnY2FiYWwtdjInIHwgJ25vbmUnLFxuICApIHtcbiAgICBjb25zdCBidWlsZGVyID0gaW5idWlsZGVyIHx8IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpXG4gICAgaWYgKCFidWlsZGVyKSB0aHJvdyBuZXcgRXJyb3IoYERlZmF1bHQgUkVQTCBub3Qgc3BlY2lmaWVkYClcblxuICAgIGNvbnN0IHsgY3dkLCBjb21wLCBjYWJhbCB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoXG4gICAgICB0aGlzLnVyaSxcbiAgICApXG4gICAgdGhpcy5jd2QgPSBjd2RcblxuICAgIGxldCBjb21tYW5kUGF0aDogc3RyaW5nXG4gICAgbGV0IGNvbW1hbmRBcmdzOiBzdHJpbmdbXVxuICAgIGxldCBleHRyYUFyZ3M6ICh4OiBzdHJpbmcpID0+IHN0cmluZ1xuICAgIHN3aXRjaCAoYnVpbGRlcikge1xuICAgICAgY2FzZSAnY2FiYWwtdjEnOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jYWJhbFBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbCcpLmxlZ2FjeUNhYmFsVjFcbiAgICAgICAgICA/IFsncmVwbCddXG4gICAgICAgICAgOiBbJ3YxLXJlcGwnXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdjYWJhbC12Mic6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gWyd2Mi1yZXBsJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjLW9wdGlvbj0ke3h9YFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnc3RhY2snOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zdGFja1BhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFsnZ2hjaSddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoY2ktb3B0aW9ucz1cIiR7eH1cImBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2doY2knOlxuICAgICAgY2FzZSAnbm9uZSc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeCkgPT4geFxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJ1aWxkZXIgJHtidWlsZGVyfWApXG4gICAgfVxuXG4gICAgY29uc3QgZXh0cmFBcmdzTGlzdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5leHRyYUFyZ3MnKSB8fCBbXVxuICAgIGNvbW1hbmRBcmdzLnB1c2goLi4uZXh0cmFBcmdzTGlzdC5tYXAoZXh0cmFBcmdzKSlcblxuICAgIGlmIChjb21wICYmIGNhYmFsKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBjb25zdCBjb21wYyA9IGNvbXAuc3RhcnRzV2l0aCgnbGliOicpID8gJ2xpYicgOiBjb21wXG4gICAgICAgIGNvbW1hbmRBcmdzLnB1c2goYCR7Y2FiYWwubmFtZX06JHtjb21wY31gKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChjb21wKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoKSA9PiB0aGlzLmRlc3Ryb3koKSxcbiAgICB9KVxuXG4gICAgY29uc3QgaW5pdHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuICAgIHRoaXMucHJvbXB0ID0gaW5pdHJlcy5wcm9tcHRbMV1cbiAgICBhd2FpdCB0aGlzLm9uSW5pdGlhbExvYWQoKVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihpbml0cmVzLnN0ZGVyciwgdHJ1ZSlcbiAgICByZXR1cm4gdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGVycm9yc0Zyb21TdGRlcnIoXG4gICAgc3RkZXJyOiBzdHJpbmdbXSxcbiAgICBmaWx0ZXJJbml0V2FybmluZ3MgPSBmYWxzZSxcbiAgKTogYm9vbGVhbiB7XG4gICAgY29uc3Qgbm9Jbml0V2FybmluZ3MgPSBmaWx0ZXJJbml0V2FybmluZ3NcbiAgICAgID8gKHg6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQpOiB4IGlzIElFcnJvckl0ZW0gPT5cbiAgICAgICAgICB4ICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgeC5zZXZlcml0eSA9PT0gJ3JlcGwnICYmXG4gICAgICAgICAgICBnZXRUZXh0KHgubWVzc2FnZSkubWF0Y2goXG4gICAgICAgICAgICAgIC9eU29tZSBmbGFncyBoYXZlIG5vdCBiZWVuIHJlY29nbml6ZWQ6ICg/Oig/OnByb21wdDJ8cHJvbXB0LWNvbnQpLFxccyopK1xccyovLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIClcbiAgICAgIDogKHg6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQpOiB4IGlzIElFcnJvckl0ZW0gPT4geCAhPT0gdW5kZWZpbmVkXG4gICAgcmV0dXJuIHRoaXMuYXBwZW5kRXJyb3JzKFxuICAgICAgc3RkZXJyXG4gICAgICAgIC5maWx0ZXIoKHgpID0+ICEvXlxccypcXGQqIFxcfC8udGVzdCh4KSlcbiAgICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICAgIC5zcGxpdCgvXFxuKD89XFxTKS8pXG4gICAgICAgIC5tYXAodGhpcy5wYXJzZU1lc3NhZ2UpXG4gICAgICAgIC5maWx0ZXIobm9Jbml0V2FybmluZ3MpLFxuICAgIClcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50OiBudW1iZXIgfCB1bmRlZmluZWRcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgaWYgKCFtaW5JbmRlbnQgfHwgbGluZUluZGVudCA8IG1pbkluZGVudCkge1xuICAgICAgICAgIG1pbkluZGVudCA9IGxpbmVJbmRlbnRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobWluSW5kZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1pID0gbWluSW5kZW50XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaSkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZSA9IChyYXc6IHN0cmluZyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQgPT4ge1xuICAgIGlmICghdGhpcy5jd2QpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/WyBcXHRdKihcXFtbXlxcXV0rXFxdKT9bIFxcdF0qXFxuPyhbXl0qKS9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgW2ZpbGVjLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dCwgbXNnXTogQXJyYXk8XG4gICAgICAgICAgc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgID4gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFVQSS5UU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlXG4gICAgICAgICAgICA/IGlzQWJzb2x1dGUoZmlsZSlcbiAgICAgICAgICAgICAgPyBub3JtYWxpemUoZmlsZSlcbiAgICAgICAgICAgICAgOiB0aGlzLmN3ZC5nZXRGaWxlKGZpbGUpLmdldFBhdGgoKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcG9zaXRpb246IFtcbiAgICAgICAgICAgIHBhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgICAgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMudW5pbmRlbnRNZXNzYWdlKFxuICAgICAgICAgICAgICAobXNnIGFzIHN0cmluZyAmIHsgdHJpbVJpZ2h0KCk6IHN0cmluZyB9KS50cmltUmlnaHQoKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBoaWdobGlnaHRlcjogJ2hpbnQubWVzc2FnZS5oYXNrZWxsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmRFcnJvcnMoZXJyb3JzOiBJRXJyb3JJdGVtW10pOiBib29sZWFuIHtcbiAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2VcbiAgICBsZXQgbmV3TWVzc2FnZXMgPSBmYWxzZVxuICAgIGxldCBuZXdFcnJvcnMgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgICBjb25zdCBkdXBJZHggPSB0aGlzLmVycm9ycy5maW5kSW5kZXgoKHgpID0+IGlzU2FtZUVycm9yKGVycm9yLCB4KSlcbiAgICAgIGlmIChkdXBJZHggPj0gMCkge1xuICAgICAgICBpZiAodGhpcy5lcnJvcnNbZHVwSWR4XS5fdGltZSA8PSBlcnJvci5fdGltZSkge1xuICAgICAgICAgIHRoaXMuZXJyb3JzW2R1cElkeF0uX3RpbWUgPSBlcnJvci5fdGltZVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKGVycm9yKVxuICAgICAgfVxuICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSBoYXNFcnJvcnMgPSB0cnVlXG4gICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdyZXBsJykgbmV3TWVzc2FnZXMgPSB0cnVlXG4gICAgICBlbHNlIG5ld0Vycm9ycyA9IHRydWVcbiAgICB9XG4gICAgY29uc3QgZXJyTWVzc2FnZXMgPSBlcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ID09PSAncmVwbCcpXG4gICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5lcnJvcnNJbk91dHB1dCcpKSB7XG4gICAgICBmb3IgKGNvbnN0IG0gb2YgZXJyTWVzc2FnZXMpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICB0ZXh0OiBnZXRUZXh0KG0ubWVzc2FnZSksXG4gICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1zdGRlcnInLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNldEVycm9ycyh0aGlzLmVycm9ycywgbmV3RXJyb3JzLCBuZXdNZXNzYWdlcylcbiAgICByZXR1cm4gaGFzRXJyb3JzXG4gIH1cblxuICBwcml2YXRlIHNldEVycm9ycyhcbiAgICBlcnJvcnM6IElFcnJvckl0ZW1bXSxcbiAgICBuZXdFcnJvcnMgPSB0cnVlLFxuICAgIG5ld01lc3NhZ2VzID0gdHJ1ZSxcbiAgKSB7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnNcbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIGlmIChuZXdNZXNzYWdlcykge1xuICAgICAgICB0aGlzLnVwaS5zZXRNZXNzYWdlcyhcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgPT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChuZXdFcnJvcnMpIHtcbiAgICAgICAgdGhpcy51cGkuc2V0RXJyb3JzKFxuICAgICAgICAgIHRoaXMuZXJyb3JTcm91Y2UsXG4gICAgICAgICAgdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ICE9PSAncmVwbCcpLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXJyb3JzSW5PdXRwdXQnKSkge1xuICAgICAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcigoeyBzZXZlcml0eSB9KSA9PiBzZXZlcml0eSAhPT0gJ3JlcGwnKVxuICAgICAgfVxuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKVxuICAgICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5maWx0ZXIoXG4gICAgICAgICh4KSA9PiB4LnVyaSAhPT0gdW5kZWZpbmVkIHx8IG5vdyAtIHguX3RpbWUgPCAzMDAwLFxuICAgICAgKVxuICAgIH1cbiAgICBoYW5kbGVQcm9taXNlKHRoaXMudXBkYXRlKCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTYW1lRXJyb3IoZTE6IElFcnJvckl0ZW0sIGUyOiBJRXJyb3JJdGVtKSB7XG4gIGNvbnN0IHNhbWVDb250ZXh0ID0gZTEuY29udGV4dCA9PT0gZTIuY29udGV4dFxuICBjb25zdCBzYW1lUG9zID1cbiAgICBlMS5wb3NpdGlvbiAmJlxuICAgIGUyLnBvc2l0aW9uICYmXG4gICAgQXRvbVR5cGVzLlBvaW50LmZyb21PYmplY3QoZTEucG9zaXRpb24pLmlzRXF1YWwoZTIucG9zaXRpb24pXG4gIGNvbnN0IHNhbWVTZXZlcml0eSA9IGUxLnNldmVyaXR5ID09PSBlMi5zZXZlcml0eVxuICBjb25zdCBzYW1lVXJpID0gZTEudXJpID09PSBlMi51cmlcbiAgY29uc3Qgc2FtZU1lc3NhZ2UgPSBpc1NhbWVNZXNzYWdlKGUxLm1lc3NhZ2UsIGUyLm1lc3NhZ2UpXG4gIHJldHVybiBzYW1lQ29udGV4dCAmJiBzYW1lUG9zICYmIHNhbWVTZXZlcml0eSAmJiBzYW1lVXJpICYmIHNhbWVNZXNzYWdlXG59XG5cbmZ1bmN0aW9uIGlzU2FtZU1lc3NhZ2UobTE6IFVQSS5UTWVzc2FnZSwgbTI6IFVQSS5UTWVzc2FnZSkge1xuICBpZiAodHlwZW9mIG0xID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbTIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIG0xID09PSBtMlxuICB9IGVsc2UgaWYgKCdodG1sJyBpbiBtMSAmJiAnaHRtbCcgaW4gbTIpIHtcbiAgICByZXR1cm4gbTEuaHRtbCA9PT0gbTIuaHRtbFxuICB9IGVsc2UgaWYgKCd0ZXh0JyBpbiBtMSAmJiAndGV4dCcgaW4gbTIpIHtcbiAgICByZXR1cm4gbTEudGV4dCA9PT0gbTIudGV4dCAmJiBtMS5oaWdobGlnaHRlciA9PT0gbTIuaGlnaGxpZ2h0ZXJcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuIl19