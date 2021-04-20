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
        this.destroyed = false;
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
        if (this.destroyed)
            return;
        this.destroyed = true;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBQzVDLGlDQUErQztBQXVCL0MsS0FBSyxVQUFVLGFBQWEsQ0FDMUIsU0FBeUI7SUFFekIsTUFBTSxhQUFhLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUE7SUFDNUMsSUFBSSxhQUFhLEtBQUssSUFBSTtRQUFFLE9BQU8sU0FBUyxDQUFBO0lBQzVDLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFBO0lBQ3ZELElBQUksTUFBTSxLQUFLLGFBQWEsRUFBRTtRQUM1QixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDM0Isa0RBQWtELEVBQ2xEO1lBQ0UsTUFBTSxFQUNKLHNFQUFzRTtnQkFDdEUsaUVBQWlFO2dCQUNqRSxxRUFBcUU7Z0JBQ3JFLDJEQUEyRDtZQUM3RCxXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUNGLENBQUE7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZLENBQ3pCLE9BQTRCO0lBRTVCLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQzVCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ2xCLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDckMsSUFBSSxLQUFLLEVBQUU7WUFDVCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7U0FDZDthQUFNO1lBQ0wsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1NBQ2xCO0lBQ0gs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TSxJQUFJLEVBQUUsRUFBRTtRQUN2QyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLEVBQUUsQ0FBQyxXQUFXLENBQUE7S0FDaEU7U0FBTTtRQUNMLE9BQU8sS0FBSyxDQUFBO0tBQ2I7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgVXRpbCBmcm9tICdhdG9tLWhhc2tlbGwtdXRpbHMnXG5pbXBvcnQgeyBmaWx0ZXIgfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQgeyBDb21tYW5kSGlzdG9yeSB9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHsgR0hDSSwgSVJlcXVlc3RSZXN1bHQgfSBmcm9tICcuL2doY2knXG5pbXBvcnQgKiBhcyBVUEkgZnJvbSAnYXRvbS1oYXNrZWxsLXVwaSdcbmltcG9ydCAqIGFzIEF0b21UeXBlcyBmcm9tICdhdG9tJ1xuaW1wb3J0IHsgVVBJQ29uc3VtZXIgfSBmcm9tICcuL3VwaUNvbnN1bWVyJ1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSwgbm9ybWFsaXplIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IGhhbmRsZVByb21pc2UsIGdldFRleHQgfSBmcm9tICcuL3V0aWwnXG5cbmV4cG9ydCB7IElSZXF1ZXN0UmVzdWx0IH1cblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1N0YXRlIHtcbiAgdXJpPzogc3RyaW5nXG4gIGhpc3Rvcnk/OiBzdHJpbmdbXVxuICBhdXRvUmVsb2FkUmVwZWF0PzogYm9vbGVhblxuICBjb250ZW50PzogSUNvbnRlbnRJdGVtW11cbiAgZm9jdXM/OiBib29sZWFuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxuICBobGNhY2hlPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSBleHRlbmRzIFVQSS5JUmVzdWx0SXRlbSB7XG4gIF90aW1lOiBudW1iZXJcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZENhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IGNhYmFsQ29udGVudHMgPSBhd2FpdCBjYWJhbEZpbGUucmVhZCgpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkXG4gIGNvbnN0IG5vVGFicyA9IGNhYmFsQ29udGVudHMucmVwbGFjZSgvXFx0L2csICcgICAgICAgICcpXG4gIGlmIChub1RhYnMgIT09IGNhYmFsQ29udGVudHMpIHtcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICdUYWJzIGZvdW5kIGluIENhYmFsZmlsZSwgcmVwbGFjaW5nIHdpdGggOCBzcGFjZXMnLFxuICAgICAge1xuICAgICAgICBkZXRhaWw6XG4gICAgICAgICAgJ1RhYnMgYXJlIG5vdCBhbGxvd2VkIGFzIGluZGVudGF0aW9uIGNoYXJhY3RlcnMgaW4gQ2FiYWxmaWxlcyBkdWUgdG8gJyArXG4gICAgICAgICAgJ2EgbWlzc2luZyBzdGFuZGFyZCBpbnRlcnByZXRhdGlvbiBvZiB0YWIgd2lkdGguIFRhYnMgaGF2ZSBiZWVuICcgK1xuICAgICAgICAgICdhdXRvbWF0aWNhbGx5IHJlcGxhY2VkIGJ5IDggc3BhY2VzIGFzIHBlciBIYXNrZWxsIHJlcG9ydCBzdGFuZGFyZCwgJyArXG4gICAgICAgICAgJ2J1dCBpdCBpcyBhZHZpc2VkIHRvIGF2b2lkIHVzaW5nIHRhYnVsYXRpb24gaW4gQ2FiYWxmaWxlLicsXG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICApXG4gIH1cbiAgcmV0dXJuIG5vVGFic1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDYWJhbEZpbGUoXG4gIHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4pOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgY29uc3QgY29udCA9IGF3YWl0IG5ldyBQcm9taXNlPEFycmF5PEF0b21UeXBlcy5EaXJlY3RvcnkgfCBBdG9tVHlwZXMuRmlsZT4+KFxuICAgIChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gIClcbiAgcmV0dXJuIGNvbnQuZmlsdGVyKFxuICAgIChmaWxlKSA9PiBmaWxlLmlzRmlsZSgpICYmIGZpbGUuZ2V0QmFzZU5hbWUoKS5lbmRzV2l0aCgnLmNhYmFsJyksXG4gICkgYXMgQXRvbVR5cGVzLkZpbGVbXVxufVxuXG5hc3luYyBmdW5jdGlvbiBwYXJzZUNhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbiAgY3dkOiBBdG9tVHlwZXMuRGlyZWN0b3J5LFxuICB1cmk6IHN0cmluZyB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8eyBjYWJhbD86IFV0aWwuSURvdENhYmFsOyBjb21wcz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IHJlYWRDYWJhbEZpbGUoY2FiYWxGaWxlKVxuICBpZiAoY2FiYWxDb250ZW50cyA9PT0gdW5kZWZpbmVkKSByZXR1cm4ge31cbiAgY29uc3QgY2FiYWwgPSBhd2FpdCBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgbGV0IGNvbXBzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZFxuICBpZiAodXJpICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb21wcyA9IGF3YWl0IFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGUoY2FiYWxDb250ZW50cywgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgfVxuICByZXR1cm4geyBjYWJhbDogY2FiYWwgPT09IG51bGwgPyB1bmRlZmluZWQgOiBjYWJhbCwgY29tcHMgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlYWR5UHJvbWlzZTogUHJvbWlzZTx2b2lkPlxuICBwcm90ZWN0ZWQgZ2hjaT86IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZD86IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nID0gJydcbiAgcHJvdGVjdGVkIHVwaT86IFVQSUNvbnN1bWVyXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdID0gW11cbiAgcHJvdGVjdGVkIF9hdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByb3RlY3RlZCBoaXN0b3J5OiBDb21tYW5kSGlzdG9yeVxuICBwcm90ZWN0ZWQgdXJpOiBzdHJpbmdcbiAgcHJvdGVjdGVkIGRlc3Ryb3llZCA9IGZhbHNlXG4gIHByaXZhdGUgZW1pdHRlciA9IG5ldyBBdG9tVHlwZXMuRW1pdHRlcjx7IGRlc3Ryb3llZDogdm9pZCB9PigpXG5cbiAgY29uc3RydWN0b3IoXG4gICAgdXBpUHJvbWlzZTogUHJvbWlzZTxVUElDb25zdW1lciB8IHVuZGVmaW5lZD4sXG4gICAge1xuICAgICAgdXJpLFxuICAgICAgY29udGVudCxcbiAgICAgIGhpc3RvcnksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9OiBJVmlld1N0YXRlLFxuICAgIHByb3RlY3RlZCByZWFkb25seSBlcnJvclNyb3VjZTogc3RyaW5nLFxuICApIHtcbiAgICB0aGlzLnVyaSA9IHVyaSB8fCAnJ1xuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSAhIWF1dG9SZWxvYWRSZXBlYXRcblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IHRoaXMuaW5pdGlhbGl6ZSh1cGlQcm9taXNlKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyKHVyaTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIFV0aWwuZ2V0Um9vdERpcih1cmkpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGNvbXBvbmVudEZyb21VUkkodXJpOiBzdHJpbmcpIHtcbiAgICBjb25zdCBjd2QgPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Um9vdERpcih1cmkpXG4gICAgY29uc3QgW2NhYmFsRmlsZV0gPSBhd2FpdCBnZXRDYWJhbEZpbGUoY3dkKVxuXG4gICAgbGV0IGNvbXA6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgIGxldCBjYWJhbDogVXRpbC5JRG90Q2FiYWwgfCB1bmRlZmluZWRcbiAgICBpZiAoY2FiYWxGaWxlKSB7XG4gICAgICBjb25zdCBwYXJzZWQgPSBhd2FpdCBwYXJzZUNhYmFsRmlsZShjYWJhbEZpbGUsIGN3ZCwgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgICAgIGlmIChwYXJzZWQuY29tcHMpIGNvbXAgPSBwYXJzZWQuY29tcHNbMF1cbiAgICAgIGlmIChwYXJzZWQuY2FiYWwpIGNhYmFsID0gcGFyc2VkLmNhYmFsXG4gICAgfVxuICAgIHJldHVybiB7IGN3ZCwgY29tcCwgY2FiYWwgfVxuICB9XG5cbiAgcHVibGljIGFic3RyYWN0IGFzeW5jIHVwZGF0ZShwcm9wcz86IGFueSk6IFByb21pc2U8dm9pZD5cblxuICBwdWJsaWMgb25EaWREZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZW1pdHRlci5vbignZGVzdHJveWVkJywgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCgpIHtcbiAgICB0aGlzLmF1dG9SZWxvYWRSZXBlYXQgPSAhdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAobGluZUluZm8pID0+IHtcbiAgICAgIHN3aXRjaCAobGluZUluZm8udHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OiBsaW5lSW5mby5saW5lLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSBsaW5lSW5mby5wcm9tcHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgICBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOmwnKSkgYXdhaXQgdGhpcy5vbkxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzpyJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzplJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgeyBwcm9tcHQsIHN0ZGVyciB9ID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5wcm9tcHQgPSBwcm9tcHRbMV1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gICAgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuICF0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQoKSB7XG4gICAgaWYgKGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LnBlZWsoLTEpXG4gICAgICBpZiAoY29tbWFuZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyhwcmVmaXg6IHN0cmluZykge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgaWYgKCFyZXMpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXMuc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHJlcy5zdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe1xuICAgICAgdGV4dDogdGV4dC5zbGljZSgxLCAtMSksXG4gICAgfSkpXG4gIH1cblxuICBwdWJsaWMgY2xlYXJFcnJvcnMoKSB7XG4gICAgdGhpcy5zZXRFcnJvcnMoW10pXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uUmVsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkKCkge1xuICAgIHJldHVybiB0aGlzLmNsZWFyRXJyb3JzKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2Rlc3Ryb3llZCcpXG4gICAgdGhpcy5jbGVhckVycm9ycygpXG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplKHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+KSB7XG4gICAgdGhpcy51cGkgPSBhd2FpdCB1cGlQcm9taXNlXG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIHRoaXMucnVuUkVQTCgpXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5nZXRCdWlsZGVyKClcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJ1blJFUEwoYnVpbGRlciAmJiBidWlsZGVyLm5hbWUpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc3QgZXJyb3IgPSBlIGFzIEVycm9yXG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICAgXCJpZGUtaGFza2VsbC1yZXBsOiBDb3VsZG4ndCBnZXQgYnVpbGRlci4gRmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgUkVQTFwiLFxuICAgICAgICB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICApXG4gICAgICByZXR1cm4gdGhpcy5ydW5SRVBMKClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTChcbiAgICBpbmJ1aWxkZXI/OiAnY2FiYWwtdjEnIHwgJ3N0YWNrJyB8ICdjYWJhbC12MicgfCAnbm9uZScsXG4gICkge1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBpbmJ1aWxkZXIgfHwgYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJylcbiAgICBpZiAoIWJ1aWxkZXIpIHRocm93IG5ldyBFcnJvcihgRGVmYXVsdCBSRVBMIG5vdCBzcGVjaWZpZWRgKVxuXG4gICAgY29uc3QgeyBjd2QsIGNvbXAsIGNhYmFsIH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShcbiAgICAgIHRoaXMudXJpLFxuICAgIClcbiAgICB0aGlzLmN3ZCA9IGN3ZFxuXG4gICAgbGV0IGNvbW1hbmRQYXRoOiBzdHJpbmdcbiAgICBsZXQgY29tbWFuZEFyZ3M6IHN0cmluZ1tdXG4gICAgbGV0IGV4dHJhQXJnczogKHg6IHN0cmluZykgPT4gc3RyaW5nXG4gICAgc3dpdGNoIChidWlsZGVyKSB7XG4gICAgICBjYXNlICdjYWJhbC12MSc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsJykubGVnYWN5Q2FiYWxWMVxuICAgICAgICAgID8gWydyZXBsJ11cbiAgICAgICAgICA6IFsndjEtcmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2NhYmFsLXYyJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbJ3YyLXJlcGwnXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdzdGFjayc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gWydnaGNpJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZ2hjaSc6XG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFtdXG4gICAgICAgIGV4dHJhQXJncyA9ICh4KSA9PiB4XG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbGRlciAke2J1aWxkZXJ9YClcbiAgICB9XG5cbiAgICBjb25zdCBleHRyYUFyZ3NMaXN0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpIHx8IFtdXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi5leHRyYUFyZ3NMaXN0Lm1hcChleHRyYUFyZ3MpKVxuXG4gICAgaWYgKGNvbXAgJiYgY2FiYWwpIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGNvbnN0IGNvbXBjID0gY29tcC5zdGFydHNXaXRoKCdsaWI6JykgPyAnbGliJyA6IGNvbXBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChgJHtjYWJhbC5uYW1lfToke2NvbXBjfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGNvbXApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jICgpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKGluaXRyZXMuc3RkZXJyLCB0cnVlKVxuICAgIHJldHVybiB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVycihcbiAgICBzdGRlcnI6IHN0cmluZ1tdLFxuICAgIGZpbHRlckluaXRXYXJuaW5ncyA9IGZhbHNlLFxuICApOiBib29sZWFuIHtcbiAgICBjb25zdCBub0luaXRXYXJuaW5ncyA9IGZpbHRlckluaXRXYXJuaW5nc1xuICAgICAgPyAoeDogSUVycm9ySXRlbSB8IHVuZGVmaW5lZCk6IHggaXMgSUVycm9ySXRlbSA9PlxuICAgICAgICAgIHggIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICEoXG4gICAgICAgICAgICB4LnNldmVyaXR5ID09PSAncmVwbCcgJiZcbiAgICAgICAgICAgIGdldFRleHQoeC5tZXNzYWdlKS5tYXRjaChcbiAgICAgICAgICAgICAgL15Tb21lIGZsYWdzIGhhdmUgbm90IGJlZW4gcmVjb2duaXplZDogKD86KD86cHJvbXB0Mnxwcm9tcHQtY29udCksXFxzKikrXFxzKi8sXG4gICAgICAgICAgICApXG4gICAgICAgICAgKVxuICAgICAgOiAoeDogSUVycm9ySXRlbSB8IHVuZGVmaW5lZCk6IHggaXMgSUVycm9ySXRlbSA9PiB4ICE9PSB1bmRlZmluZWRcbiAgICByZXR1cm4gdGhpcy5hcHBlbmRFcnJvcnMoXG4gICAgICBzdGRlcnJcbiAgICAgICAgLmZpbHRlcigoeCkgPT4gIS9eXFxzKlxcZCogXFx8Ly50ZXN0KHgpKVxuICAgICAgICAuam9pbignXFxuJylcbiAgICAgICAgLnNwbGl0KC9cXG4oPz1cXFMpLylcbiAgICAgICAgLm1hcCh0aGlzLnBhcnNlTWVzc2FnZSlcbiAgICAgICAgLmZpbHRlcihub0luaXRXYXJuaW5ncyksXG4gICAgKVxuICB9XG5cbiAgcHJvdGVjdGVkIHVuaW5kZW50TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQ6IG51bWJlciB8IHVuZGVmaW5lZFxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3QgbGluZUluZGVudCA9IG1hdGNoWzBdLmxlbmd0aFxuICAgICAgICBpZiAoIW1pbkluZGVudCB8fCBsaW5lSW5kZW50IDwgbWluSW5kZW50KSB7XG4gICAgICAgICAgbWluSW5kZW50ID0gbGluZUluZGVudFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChtaW5JbmRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgbWkgPSBtaW5JbmRlbnRcbiAgICAgIGxpbmVzID0gbGluZXMubWFwKChsaW5lKSA9PiBsaW5lLnNsaWNlKG1pKSlcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGFyc2VNZXNzYWdlID0gKHJhdzogc3RyaW5nKTogSUVycm9ySXRlbSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgaWYgKCF0aGlzLmN3ZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBjb25zdCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9bIFxcdF0qKFxcW1teXFxdXStcXF0pP1sgXFx0XSpcXG4/KFteXSopL1xuICAgIGlmIChyYXcgJiYgcmF3LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIGNvbnN0IG1hdGNoZWQgPSByYXcubWF0Y2gobWF0Y2hMb2MpXG4gICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICBjb25zdCBbZmlsZWMsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0LCBtc2ddOiBBcnJheTxcbiAgICAgICAgICBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgICAgPiA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogVVBJLlRTZXZlcml0eSA9IHJhd1R5cCA/IHJhd1R5cC50b0xvd2VyQ2FzZSgpIDogJ2Vycm9yJ1xuICAgICAgICBsZXQgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgIGlmIChmaWxlYyA9PT0gJzxpbnRlcmFjdGl2ZT4nKSB7XG4gICAgICAgICAgZmlsZSA9IHVuZGVmaW5lZFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpbGUgPSBmaWxlY1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGVcbiAgICAgICAgICAgID8gaXNBYnNvbHV0ZShmaWxlKVxuICAgICAgICAgICAgICA/IG5vcm1hbGl6ZShmaWxlKVxuICAgICAgICAgICAgICA6IHRoaXMuY3dkLmdldEZpbGUoZmlsZSkuZ2V0UGF0aCgpXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwb3NpdGlvbjogW1xuICAgICAgICAgICAgcGFyc2VJbnQobGluZSBhcyBzdHJpbmcsIDEwKSAtIDEsXG4gICAgICAgICAgICBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UoXG4gICAgICAgICAgICAgIChtc2cgYXMgc3RyaW5nICYgeyB0cmltUmlnaHQoKTogc3RyaW5nIH0pLnRyaW1SaWdodCgpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZEVycm9ycyhlcnJvcnM6IElFcnJvckl0ZW1bXSk6IGJvb2xlYW4ge1xuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGxldCBuZXdNZXNzYWdlcyA9IGZhbHNlXG4gICAgbGV0IG5ld0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnN0IGR1cElkeCA9IHRoaXMuZXJyb3JzLmZpbmRJbmRleCgoeCkgPT4gaXNTYW1lRXJyb3IoZXJyb3IsIHgpKVxuICAgICAgaWYgKGR1cElkeCA+PSAwKSB7XG4gICAgICAgIGlmICh0aGlzLmVycm9yc1tkdXBJZHhdLl90aW1lIDw9IGVycm9yLl90aW1lKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcnNbZHVwSWR4XS5fdGltZSA9IGVycm9yLl90aW1lXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICB9XG4gICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdlcnJvcicpIGhhc0Vycm9ycyA9IHRydWVcbiAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ3JlcGwnKSBuZXdNZXNzYWdlcyA9IHRydWVcbiAgICAgIGVsc2UgbmV3RXJyb3JzID0gdHJ1ZVxuICAgIH1cbiAgICBjb25zdCBlcnJNZXNzYWdlcyA9IGVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgPT09ICdyZXBsJylcbiAgICBpZiAoYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmVycm9yc0luT3V0cHV0JykpIHtcbiAgICAgIGZvciAoY29uc3QgbSBvZiBlcnJNZXNzYWdlcykge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgIHRleHQ6IGdldFRleHQobS5tZXNzYWdlKSxcbiAgICAgICAgICBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLXN0ZGVycicsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2V0RXJyb3JzKHRoaXMuZXJyb3JzLCBuZXdFcnJvcnMsIG5ld01lc3NhZ2VzKVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByaXZhdGUgc2V0RXJyb3JzKFxuICAgIGVycm9yczogSUVycm9ySXRlbVtdLFxuICAgIG5ld0Vycm9ycyA9IHRydWUsXG4gICAgbmV3TWVzc2FnZXMgPSB0cnVlLFxuICApIHtcbiAgICB0aGlzLmVycm9ycyA9IGVycm9yc1xuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgaWYgKG5ld01lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMudXBpLnNldE1lc3NhZ2VzKFxuICAgICAgICAgIHRoaXMuZXJyb3JzLmZpbHRlcigoeyBzZXZlcml0eSB9KSA9PiBzZXZlcml0eSA9PT0gJ3JlcGwnKSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgaWYgKG5ld0Vycm9ycykge1xuICAgICAgICB0aGlzLnVwaS5zZXRFcnJvcnMoXG4gICAgICAgICAgdGhpcy5lcnJvclNyb3VjZSxcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgIT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5lcnJvcnNJbk91dHB1dCcpKSB7XG4gICAgICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ICE9PSAncmVwbCcpXG4gICAgICB9XG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpXG4gICAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcihcbiAgICAgICAgKHgpID0+IHgudXJpICE9PSB1bmRlZmluZWQgfHwgbm93IC0geC5fdGltZSA8IDMwMDAsXG4gICAgICApXG4gICAgfVxuICAgIGhhbmRsZVByb21pc2UodGhpcy51cGRhdGUoKSlcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NhbWVFcnJvcihlMTogSUVycm9ySXRlbSwgZTI6IElFcnJvckl0ZW0pIHtcbiAgY29uc3Qgc2FtZUNvbnRleHQgPSBlMS5jb250ZXh0ID09PSBlMi5jb250ZXh0XG4gIGNvbnN0IHNhbWVQb3MgPVxuICAgIGUxLnBvc2l0aW9uICYmXG4gICAgZTIucG9zaXRpb24gJiZcbiAgICBBdG9tVHlwZXMuUG9pbnQuZnJvbU9iamVjdChlMS5wb3NpdGlvbikuaXNFcXVhbChlMi5wb3NpdGlvbilcbiAgY29uc3Qgc2FtZVNldmVyaXR5ID0gZTEuc2V2ZXJpdHkgPT09IGUyLnNldmVyaXR5XG4gIGNvbnN0IHNhbWVVcmkgPSBlMS51cmkgPT09IGUyLnVyaVxuICBjb25zdCBzYW1lTWVzc2FnZSA9IGlzU2FtZU1lc3NhZ2UoZTEubWVzc2FnZSwgZTIubWVzc2FnZSlcbiAgcmV0dXJuIHNhbWVDb250ZXh0ICYmIHNhbWVQb3MgJiYgc2FtZVNldmVyaXR5ICYmIHNhbWVVcmkgJiYgc2FtZU1lc3NhZ2Vcbn1cblxuZnVuY3Rpb24gaXNTYW1lTWVzc2FnZShtMTogVVBJLlRNZXNzYWdlLCBtMjogVVBJLlRNZXNzYWdlKSB7XG4gIGlmICh0eXBlb2YgbTEgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBtMiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbTEgPT09IG0yXG4gIH0gZWxzZSBpZiAoJ2h0bWwnIGluIG0xICYmICdodG1sJyBpbiBtMikge1xuICAgIHJldHVybiBtMS5odG1sID09PSBtMi5odG1sXG4gIH0gZWxzZSBpZiAoJ3RleHQnIGluIG0xICYmICd0ZXh0JyBpbiBtMikge1xuICAgIHJldHVybiBtMS50ZXh0ID09PSBtMi50ZXh0ICYmIG0xLmhpZ2hsaWdodGVyID09PSBtMi5oaWdobGlnaHRlclxuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG4iXX0=