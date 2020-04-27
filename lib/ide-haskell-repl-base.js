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
        const errors = [];
        let hasErrors = false;
        let newMessages = false;
        let newErrors = false;
        for (const err of stderr
            .filter((x) => !/^\s*\d* \|/.test(x))
            .join('\n')
            .split(/\n(?=\S)/)) {
            if (err) {
                const error = this.parseMessage(err);
                if (error) {
                    if (filterInitWarnings &&
                        error.severity === 'repl' &&
                        typeof error.message === 'string' &&
                        error.message.match(/^Some flags have not been recognized: (?:(?:prompt2|prompt-cont),\s*)+\s*/)) {
                        continue;
                    }
                    errors.push(error);
                    if (error.severity === 'error')
                        hasErrors = true;
                    if (error.severity === 'repl')
                        newMessages = true;
                    else
                        newErrors = true;
                }
            }
        }
        this.appendErrors(errors, newErrors, newMessages);
        return hasErrors;
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
    parseMessage(raw) {
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
    }
    appendErrors(errors, newErrors, newMessages) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBQzVDLGlDQUErQztBQXVCL0MsS0FBSyxVQUFVLGFBQWEsQ0FDMUIsU0FBeUI7SUFFekIsTUFBTSxhQUFhLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUE7SUFDNUMsSUFBSSxhQUFhLEtBQUssSUFBSTtRQUFFLE9BQU8sU0FBUyxDQUFBO0lBQzVDLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFBO0lBQ3ZELElBQUksTUFBTSxLQUFLLGFBQWEsRUFBRTtRQUM1QixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDM0Isa0RBQWtELEVBQ2xEO1lBQ0UsTUFBTSxFQUNKLHNFQUFzRTtnQkFDdEUsaUVBQWlFO2dCQUNqRSxxRUFBcUU7Z0JBQ3JFLDJEQUEyRDtZQUM3RCxXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUNGLENBQUE7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZLENBQ3pCLE9BQTRCO0lBRTVCLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQzVCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ2xCLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDckMsSUFBSSxLQUFLLEVBQUU7WUFDVCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7U0FDZDthQUFNO1lBQ0wsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1NBQ2xCO0lBQ0gs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RUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEtBQUssRUFBRSxDQUFDLFdBQVcsQ0FBQTtLQUNoRTtTQUFNO1FBQ0wsT0FBTyxLQUFLLENBQUE7S0FDYjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7IGZpbHRlciB9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7IENvbW1hbmRIaXN0b3J5IH0gZnJvbSAnLi9jb21tYW5kLWhpc3RvcnknXG5pbXBvcnQgeyBHSENJLCBJUmVxdWVzdFJlc3VsdCB9IGZyb20gJy4vZ2hjaSdcbmltcG9ydCAqIGFzIFVQSSBmcm9tICdhdG9tLWhhc2tlbGwtdXBpJ1xuaW1wb3J0ICogYXMgQXRvbVR5cGVzIGZyb20gJ2F0b20nXG5pbXBvcnQgeyBVUElDb25zdW1lciB9IGZyb20gJy4vdXBpQ29uc3VtZXInXG5pbXBvcnQgeyBpc0Fic29sdXRlLCBub3JtYWxpemUgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgaGFuZGxlUHJvbWlzZSwgZ2V0VGV4dCB9IGZyb20gJy4vdXRpbCdcblxuZXhwb3J0IHsgSVJlcXVlc3RSZXN1bHQgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxuICBmb2N1cz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudEl0ZW0ge1xuICB0ZXh0OiBzdHJpbmdcbiAgY2xzOiBzdHJpbmdcbiAgaGw/OiBib29sZWFuXG4gIGhsY2FjaGU/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIGV4dGVuZHMgVVBJLklSZXN1bHRJdGVtIHtcbiAgX3RpbWU6IG51bWJlclxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgaWYgKGNhYmFsQ29udGVudHMgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWRcbiAgY29uc3Qgbm9UYWJzID0gY2FiYWxDb250ZW50cy5yZXBsYWNlKC9cXHQvZywgJyAgICAgICAgJylcbiAgaWYgKG5vVGFicyAhPT0gY2FiYWxDb250ZW50cykge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgJ1RhYnMgZm91bmQgaW4gQ2FiYWxmaWxlLCByZXBsYWNpbmcgd2l0aCA4IHNwYWNlcycsXG4gICAgICB7XG4gICAgICAgIGRldGFpbDpcbiAgICAgICAgICAnVGFicyBhcmUgbm90IGFsbG93ZWQgYXMgaW5kZW50YXRpb24gY2hhcmFjdGVycyBpbiBDYWJhbGZpbGVzIGR1ZSB0byAnICtcbiAgICAgICAgICAnYSBtaXNzaW5nIHN0YW5kYXJkIGludGVycHJldGF0aW9uIG9mIHRhYiB3aWR0aC4gVGFicyBoYXZlIGJlZW4gJyArXG4gICAgICAgICAgJ2F1dG9tYXRpY2FsbHkgcmVwbGFjZWQgYnkgOCBzcGFjZXMgYXMgcGVyIEhhc2tlbGwgcmVwb3J0IHN0YW5kYXJkLCAnICtcbiAgICAgICAgICAnYnV0IGl0IGlzIGFkdmlzZWQgdG8gYXZvaWQgdXNpbmcgdGFidWxhdGlvbiBpbiBDYWJhbGZpbGUuJyxcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICB9LFxuICAgIClcbiAgfVxuICByZXR1cm4gbm9UYWJzXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENhYmFsRmlsZShcbiAgcm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSxcbik6IFByb21pc2U8QXRvbVR5cGVzLkZpbGVbXT4ge1xuICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJvb3REaXIuZ2V0RW50cmllcygoZXJyb3IsIGNvbnRlbnRzKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKGNvbnRlbnRzKVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgKVxuICByZXR1cm4gY29udC5maWx0ZXIoXG4gICAgKGZpbGUpID0+IGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSxcbiAgKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBhcnNlQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuICBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4gIHVyaTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTx7IGNhYmFsPzogVXRpbC5JRG90Q2FiYWw7IGNvbXBzPzogc3RyaW5nW10gfT4ge1xuICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgcmVhZENhYmFsRmlsZShjYWJhbEZpbGUpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSB1bmRlZmluZWQpIHJldHVybiB7fVxuICBjb25zdCBjYWJhbCA9IGF3YWl0IFV0aWwucGFyc2VEb3RDYWJhbChjYWJhbENvbnRlbnRzKVxuICBsZXQgY29tcHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkXG4gIGlmICh1cmkgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBzID0gYXdhaXQgVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZShjYWJhbENvbnRlbnRzLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICB9XG4gIHJldHVybiB7IGNhYmFsOiBjYWJhbCA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IGNhYmFsLCBjb21wcyB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+XG4gIHByb3RlY3RlZCBnaGNpPzogR0hDSVxuICBwcm90ZWN0ZWQgY3dkPzogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcm90ZWN0ZWQgcHJvbXB0OiBzdHJpbmcgPSAnJ1xuICBwcm90ZWN0ZWQgdXBpPzogVVBJQ29uc3VtZXJcbiAgcHJvdGVjdGVkIG1lc3NhZ2VzOiBJQ29udGVudEl0ZW1bXVxuICBwcm90ZWN0ZWQgZXJyb3JzOiBJRXJyb3JJdGVtW10gPSBbXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcml2YXRlIGVtaXR0ZXIgPSBuZXcgQXRvbVR5cGVzLkVtaXR0ZXI8eyBkZXN0cm95ZWQ6IHZvaWQgfT4oKVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+LFxuICAgIHtcbiAgICAgIHVyaSxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBoaXN0b3J5LFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfTogSVZpZXdTdGF0ZSxcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgZXJyb3JTcm91Y2U6IHN0cmluZyxcbiAgKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gISFhdXRvUmVsb2FkUmVwZWF0XG5cbiAgICB0aGlzLm1lc3NhZ2VzID0gY29udGVudCB8fCBbXVxuXG4gICAgdGhpcy5yZWFkeVByb21pc2UgPSB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpcih1cmk6IHN0cmluZykge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBjb21wb25lbnRGcm9tVVJJKHVyaTogc3RyaW5nKSB7XG4gICAgY29uc3QgY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodXJpKVxuICAgIGNvbnN0IFtjYWJhbEZpbGVdID0gYXdhaXQgZ2V0Q2FiYWxGaWxlKGN3ZClcblxuICAgIGxldCBjb21wOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICBsZXQgY2FiYWw6IFV0aWwuSURvdENhYmFsIHwgdW5kZWZpbmVkXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgY29uc3QgcGFyc2VkID0gYXdhaXQgcGFyc2VDYWJhbEZpbGUoY2FiYWxGaWxlLCBjd2QsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gICAgICBpZiAocGFyc2VkLmNvbXBzKSBjb21wID0gcGFyc2VkLmNvbXBzWzBdXG4gICAgICBpZiAocGFyc2VkLmNhYmFsKSBjYWJhbCA9IHBhcnNlZC5jYWJhbFxuICAgIH1cbiAgICByZXR1cm4geyBjd2QsIGNvbXAsIGNhYmFsIH1cbiAgfVxuXG4gIHB1YmxpYyBhYnN0cmFjdCBhc3luYyB1cGRhdGUocHJvcHM/OiBhbnkpOiBQcm9taXNlPHZvaWQ+XG5cbiAgcHVibGljIG9uRGlkRGVzdHJveShjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgIHJldHVybiB0aGlzLmVtaXR0ZXIub24oJ2Rlc3Ryb3llZCcsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQoKSB7XG4gICAgdGhpcy5hdXRvUmVsb2FkUmVwZWF0ID0gIXRoaXMuYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkNvbW1hbmQoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCBpbnAgPSBjb21tYW5kLnNwbGl0KCdcXG4nKVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKGxpbmVJbmZvKSA9PiB7XG4gICAgICBzd2l0Y2ggKGxpbmVJbmZvLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RkaW4nOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiZcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6IGlucC5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgICAgaGw6IHRydWUsXG4gICAgICAgICAgICAgIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDogbGluZUluZm8ubGluZSxcbiAgICAgICAgICAgICAgaGw6IHRydWUsXG4gICAgICAgICAgICAgIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdwcm9tcHQnOlxuICAgICAgICAgIHRoaXMucHJvbXB0ID0gbGluZUluZm8ucHJvbXB0WzFdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gICAgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzpsJykpIGF3YWl0IHRoaXMub25Mb2FkKClcbiAgICBlbHNlIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6cicpKSBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICBlbHNlIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6ZScpKSBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IHsgcHJvbXB0LCBzdGRlcnIgfSA9IGF3YWl0IHRoaXMuZ2hjaS5yZWxvYWQoKVxuICAgIHRoaXMucHJvbXB0ID0gcHJvbXB0WzFdXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICAgIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIHJldHVybiAhdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHN0ZGVycilcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkUmVwZWF0KCkge1xuICAgIGlmIChhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKSkge1xuICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5wZWVrKC0xKVxuICAgICAgaWYgKGNvbW1hbmQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cblxuICBwdWJsaWMgc2V0IGF1dG9SZWxvYWRSZXBlYXQoYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhbikge1xuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldCBhdXRvUmVsb2FkUmVwZWF0KCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMocHJlZml4OiBzdHJpbmcpIHtcbiAgICBpZiAoIXByZWZpeC50cmltKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIGlmICghcmVzKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgcmVzLnN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihyZXMuc3Rkb3V0LCBwcmVmaXgpLm1hcCgodGV4dCkgPT4gKHtcbiAgICAgIHRleHQ6IHRleHQuc2xpY2UoMSwgLTEpLFxuICAgIH0pKVxuICB9XG5cbiAgcHVibGljIGNsZWFyRXJyb3JzKCkge1xuICAgIHRoaXMuc2V0RXJyb3JzKFtdKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblJlbG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jbGVhckVycm9ycygpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSgpIHtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnZGVzdHJveWVkJylcbiAgICB0aGlzLmNsZWFyRXJyb3JzKClcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGluaXRpYWxpemUodXBpUHJvbWlzZTogUHJvbWlzZTxVUElDb25zdW1lciB8IHVuZGVmaW5lZD4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7XG4gICAgICByZXR1cm4gdGhpcy5ydW5SRVBMKClcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYnVpbGRlciA9IGF3YWl0IHRoaXMudXBpLmdldEJ1aWxkZXIoKVxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucnVuUkVQTChidWlsZGVyICYmIGJ1aWxkZXIubmFtZSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCBlcnJvciA9IGUgYXMgRXJyb3JcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvci50b1N0cmluZygpLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgICBcImlkZS1oYXNrZWxsLXJlcGw6IENvdWxkbid0IGdldCBidWlsZGVyLiBGYWxsaW5nIGJhY2sgdG8gZGVmYXVsdCBSRVBMXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIClcbiAgICAgIHJldHVybiB0aGlzLnJ1blJFUEwoKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBydW5SRVBMKFxuICAgIGluYnVpbGRlcj86ICdjYWJhbC12MScgfCAnc3RhY2snIHwgJ2NhYmFsLXYyJyB8ICdub25lJyxcbiAgKSB7XG4gICAgY29uc3QgYnVpbGRlciA9IGluYnVpbGRlciB8fCBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKVxuICAgIGlmICghYnVpbGRlcikgdGhyb3cgbmV3IEVycm9yKGBEZWZhdWx0IFJFUEwgbm90IHNwZWNpZmllZGApXG5cbiAgICBjb25zdCB7IGN3ZCwgY29tcCwgY2FiYWwgfSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5jb21wb25lbnRGcm9tVVJJKFxuICAgICAgdGhpcy51cmksXG4gICAgKVxuICAgIHRoaXMuY3dkID0gY3dkXG5cbiAgICBsZXQgY29tbWFuZFBhdGg6IHN0cmluZ1xuICAgIGxldCBjb21tYW5kQXJnczogc3RyaW5nW11cbiAgICBsZXQgZXh0cmFBcmdzOiAoeDogc3RyaW5nKSA9PiBzdHJpbmdcbiAgICBzd2l0Y2ggKGJ1aWxkZXIpIHtcbiAgICAgIGNhc2UgJ2NhYmFsLXYxJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwnKS5sZWdhY3lDYWJhbFYxXG4gICAgICAgICAgPyBbJ3JlcGwnXVxuICAgICAgICAgIDogWyd2MS1yZXBsJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjLW9wdGlvbj0ke3h9YFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnY2FiYWwtdjInOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jYWJhbFBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFsndjItcmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ3N0YWNrJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuc3RhY2tQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbJ2doY2knXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGNpLW9wdGlvbnM9XCIke3h9XCJgXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdnaGNpJzpcbiAgICAgIGNhc2UgJ25vbmUnOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gW11cbiAgICAgICAgZXh0cmFBcmdzID0gKHgpID0+IHhcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsZGVyICR7YnVpbGRlcn1gKVxuICAgIH1cblxuICAgIGNvbnN0IGV4dHJhQXJnc0xpc3QgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJykgfHwgW11cbiAgICBjb21tYW5kQXJncy5wdXNoKC4uLmV4dHJhQXJnc0xpc3QubWFwKGV4dHJhQXJncykpXG5cbiAgICBpZiAoY29tcCAmJiBjYWJhbCkge1xuICAgICAgaWYgKGJ1aWxkZXIgPT09ICdzdGFjaycpIHtcbiAgICAgICAgY29uc3QgY29tcGMgPSBjb21wLnN0YXJ0c1dpdGgoJ2xpYjonKSA/ICdsaWInIDogY29tcFxuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGAke2NhYmFsLm5hbWV9OiR7Y29tcGN9YClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbW1hbmRBcmdzLnB1c2goY29tcClcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmdoY2kgPSBuZXcgR0hDSSh7XG4gICAgICBhdG9tUGF0aDogcHJvY2Vzcy5leGVjUGF0aCxcbiAgICAgIGNvbW1hbmQ6IGNvbW1hbmRQYXRoLFxuICAgICAgYXJnczogY29tbWFuZEFyZ3MsXG4gICAgICBjd2Q6IHRoaXMuY3dkLmdldFBhdGgoKSxcbiAgICAgIG9uRXhpdDogYXN5bmMgKCkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGNvbnN0IGluaXRyZXMgPSBhd2FpdCB0aGlzLmdoY2kud2FpdFJlYWR5KClcbiAgICB0aGlzLnByb21wdCA9IGluaXRyZXMucHJvbXB0WzFdXG4gICAgYXdhaXQgdGhpcy5vbkluaXRpYWxMb2FkKClcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIoaW5pdHJlcy5zdGRlcnIsIHRydWUpXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHByb3RlY3RlZCBlcnJvcnNGcm9tU3RkZXJyKFxuICAgIHN0ZGVycjogc3RyaW5nW10sXG4gICAgZmlsdGVySW5pdFdhcm5pbmdzID0gZmFsc2UsXG4gICk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGVycm9ycyA9IFtdXG4gICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlXG4gICAgbGV0IG5ld01lc3NhZ2VzID0gZmFsc2VcbiAgICBsZXQgbmV3RXJyb3JzID0gZmFsc2VcbiAgICBmb3IgKGNvbnN0IGVyciBvZiBzdGRlcnJcbiAgICAgIC5maWx0ZXIoKHgpID0+ICEvXlxccypcXGQqIFxcfC8udGVzdCh4KSlcbiAgICAgIC5qb2luKCdcXG4nKVxuICAgICAgLnNwbGl0KC9cXG4oPz1cXFMpLykpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB0aGlzLnBhcnNlTWVzc2FnZShlcnIpXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGZpbHRlckluaXRXYXJuaW5ncyAmJlxuICAgICAgICAgICAgZXJyb3Iuc2V2ZXJpdHkgPT09ICdyZXBsJyAmJlxuICAgICAgICAgICAgdHlwZW9mIGVycm9yLm1lc3NhZ2UgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgICBlcnJvci5tZXNzYWdlLm1hdGNoKFxuICAgICAgICAgICAgICAvXlNvbWUgZmxhZ3MgaGF2ZSBub3QgYmVlbiByZWNvZ25pemVkOiAoPzooPzpwcm9tcHQyfHByb21wdC1jb250KSxcXHMqKStcXHMqLyxcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSBoYXNFcnJvcnMgPSB0cnVlXG5cbiAgICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdyZXBsJykgbmV3TWVzc2FnZXMgPSB0cnVlXG4gICAgICAgICAgZWxzZSBuZXdFcnJvcnMgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5hcHBlbmRFcnJvcnMoZXJyb3JzLCBuZXdFcnJvcnMsIG5ld01lc3NhZ2VzKVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50OiBudW1iZXIgfCB1bmRlZmluZWRcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgaWYgKCFtaW5JbmRlbnQgfHwgbGluZUluZGVudCA8IG1pbkluZGVudCkge1xuICAgICAgICAgIG1pbkluZGVudCA9IGxpbmVJbmRlbnRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobWluSW5kZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1pID0gbWluSW5kZW50XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaSkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZShyYXc6IHN0cmluZyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5jd2QpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/WyBcXHRdKihcXFtbXlxcXV0rXFxdKT9bIFxcdF0qXFxuPyhbXl0qKS9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgW2ZpbGVjLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dCwgbXNnXTogQXJyYXk8XG4gICAgICAgICAgc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgID4gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFVQSS5UU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlXG4gICAgICAgICAgICA/IGlzQWJzb2x1dGUoZmlsZSlcbiAgICAgICAgICAgICAgPyBub3JtYWxpemUoZmlsZSlcbiAgICAgICAgICAgICAgOiB0aGlzLmN3ZC5nZXRGaWxlKGZpbGUpLmdldFBhdGgoKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcG9zaXRpb246IFtcbiAgICAgICAgICAgIHBhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgICAgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMudW5pbmRlbnRNZXNzYWdlKFxuICAgICAgICAgICAgICAobXNnIGFzIHN0cmluZyAmIHsgdHJpbVJpZ2h0KCk6IHN0cmluZyB9KS50cmltUmlnaHQoKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBoaWdobGlnaHRlcjogJ2hpbnQubWVzc2FnZS5oYXNrZWxsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmRFcnJvcnMoXG4gICAgZXJyb3JzOiBJRXJyb3JJdGVtW10sXG4gICAgbmV3RXJyb3JzOiBib29sZWFuLFxuICAgIG5ld01lc3NhZ2VzOiBib29sZWFuLFxuICApIHtcbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGVycm9ycykge1xuICAgICAgY29uc3QgZHVwSWR4ID0gdGhpcy5lcnJvcnMuZmluZEluZGV4KCh4KSA9PiBpc1NhbWVFcnJvcihlcnJvciwgeCkpXG4gICAgICBpZiAoZHVwSWR4ID49IDApIHtcbiAgICAgICAgaWYgKHRoaXMuZXJyb3JzW2R1cElkeF0uX3RpbWUgPD0gZXJyb3IuX3RpbWUpIHtcbiAgICAgICAgICB0aGlzLmVycm9yc1tkdXBJZHhdLl90aW1lID0gZXJyb3IuX3RpbWVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChlcnJvcilcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgZXJyTWVzc2FnZXMgPSBlcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ID09PSAncmVwbCcpXG4gICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5lcnJvcnNJbk91dHB1dCcpKSB7XG4gICAgICBmb3IgKGNvbnN0IG0gb2YgZXJyTWVzc2FnZXMpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICB0ZXh0OiBnZXRUZXh0KG0ubWVzc2FnZSksXG4gICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1zdGRlcnInLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNldEVycm9ycyh0aGlzLmVycm9ycywgbmV3RXJyb3JzLCBuZXdNZXNzYWdlcylcbiAgfVxuXG4gIHByaXZhdGUgc2V0RXJyb3JzKFxuICAgIGVycm9yczogSUVycm9ySXRlbVtdLFxuICAgIG5ld0Vycm9ycyA9IHRydWUsXG4gICAgbmV3TWVzc2FnZXMgPSB0cnVlLFxuICApIHtcbiAgICB0aGlzLmVycm9ycyA9IGVycm9yc1xuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgaWYgKG5ld01lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMudXBpLnNldE1lc3NhZ2VzKFxuICAgICAgICAgIHRoaXMuZXJyb3JzLmZpbHRlcigoeyBzZXZlcml0eSB9KSA9PiBzZXZlcml0eSA9PT0gJ3JlcGwnKSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgaWYgKG5ld0Vycm9ycykge1xuICAgICAgICB0aGlzLnVwaS5zZXRFcnJvcnMoXG4gICAgICAgICAgdGhpcy5lcnJvclNyb3VjZSxcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgIT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5lcnJvcnNJbk91dHB1dCcpKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ICE9PSAncmVwbCcpXG4gICAgICB9XG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpXG4gICAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcihcbiAgICAgICAgKHgpID0+IHgudXJpICE9PSB1bmRlZmluZWQgfHwgbm93IC0geC5fdGltZSA8IDMwMDAsXG4gICAgICApXG4gICAgfVxuICAgIGhhbmRsZVByb21pc2UodGhpcy51cGRhdGUoKSlcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NhbWVFcnJvcihlMTogSUVycm9ySXRlbSwgZTI6IElFcnJvckl0ZW0pIHtcbiAgY29uc3Qgc2FtZUNvbnRleHQgPSBlMS5jb250ZXh0ID09PSBlMi5jb250ZXh0XG4gIGNvbnN0IHNhbWVQb3MgPVxuICAgIGUxLnBvc2l0aW9uICYmXG4gICAgZTIucG9zaXRpb24gJiZcbiAgICBBdG9tVHlwZXMuUG9pbnQuZnJvbU9iamVjdChlMS5wb3NpdGlvbikuaXNFcXVhbChlMi5wb3NpdGlvbilcbiAgY29uc3Qgc2FtZVNldmVyaXR5ID0gZTEuc2V2ZXJpdHkgPT09IGUyLnNldmVyaXR5XG4gIGNvbnN0IHNhbWVVcmkgPSBlMS51cmkgPT09IGUyLnVyaVxuICBjb25zdCBzYW1lTWVzc2FnZSA9IGlzU2FtZU1lc3NhZ2UoZTEubWVzc2FnZSwgZTIubWVzc2FnZSlcbiAgcmV0dXJuIHNhbWVDb250ZXh0ICYmIHNhbWVQb3MgJiYgc2FtZVNldmVyaXR5ICYmIHNhbWVVcmkgJiYgc2FtZU1lc3NhZ2Vcbn1cblxuZnVuY3Rpb24gaXNTYW1lTWVzc2FnZShtMTogVVBJLlRNZXNzYWdlLCBtMjogVVBJLlRNZXNzYWdlKSB7XG4gIGlmICh0eXBlb2YgbTEgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBtMiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbTEgPT09IG0yXG4gIH0gZWxzZSBpZiAoJ2h0bWwnIGluIG0xICYmICdodG1sJyBpbiBtMikge1xuICAgIHJldHVybiBtMS5odG1sID09PSBtMi5odG1sXG4gIH0gZWxzZSBpZiAoJ3RleHQnIGluIG0xICYmICd0ZXh0JyBpbiBtMikge1xuICAgIHJldHVybiBtMS50ZXh0ID09PSBtMi50ZXh0ICYmIG0xLmhpZ2hsaWdodGVyID09PSBtMi5oaWdobGlnaHRlclxuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG4iXX0=