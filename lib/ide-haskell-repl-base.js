"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
const AtomTypes = require("atom");
const path_1 = require("path");
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
        let builder = inbuilder || atom.config.get('ide-haskell-repl.defaultRepl');
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
        const errors = this.errors;
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
        this.setErrors(errors, newErrors, newMessages);
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
            this.update();
        }
    }
}
exports.IdeHaskellReplBase = IdeHaskellReplBase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBdUI1QyxLQUFLLFVBQVUsYUFBYSxDQUMxQixTQUF5QjtJQUV6QixNQUFNLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUM1QyxJQUFJLGFBQWEsS0FBSyxJQUFJO1FBQUUsT0FBTyxTQUFTLENBQUE7SUFDNUMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUE7SUFDdkQsSUFBSSxNQUFNLEtBQUssYUFBYSxFQUFFO1FBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUMzQixrREFBa0QsRUFDbEQ7WUFDRSxNQUFNLEVBQ0osc0VBQXNFO2dCQUN0RSxpRUFBaUU7Z0JBQ2pFLHFFQUFxRTtnQkFDckUsMkRBQTJEO1lBQzdELFdBQVcsRUFBRSxJQUFJO1NBQ2xCLENBQ0YsQ0FBQTtLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUE7QUFDZixDQUFDO0FBRUQsS0FBSyxVQUFVLFlBQVksQ0FDekIsT0FBNEI7SUFFNUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDbEIsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtRQUNyQyxJQUFJLEtBQUssRUFBRTtZQUNULE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtTQUNkO2FBQU07WUFDTCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7U0FDbEI7SUFDSCxDQUFDLENBQUMsQ0FD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RyxFQUFFO2lCQUNsQixDQUFBO2FBQ0Y7U0FDRjthQUFNO1lBQ0wsT0FBTyxTQUFTLENBQUE7U0FDakI7SUFDSCxDQUFDO0lBRU8sU0FBUyxDQUNmLE1BQW9CLEVBQ3BCLFNBQVMsR0FBRyxJQUFJLEVBQ2hCLFdBQVcsR0FBRyxJQUFJO1FBRWxCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFBO1FBQ3BCLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNaLElBQUksV0FBVyxFQUFFO2dCQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUNsQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FDMUQsQ0FBQTthQUNGO1lBQ0QsSUFBSSxTQUFTLEVBQUU7Z0JBQ2IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQ2hCLElBQUksQ0FBQyxXQUFXLEVBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxLQUFLLE1BQU0sQ0FBQyxDQUMxRCxDQUFBO2FBQ0Y7U0FDRjthQUFNO1lBRUwsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1NBQ2Q7SUFDSCxDQUFDO0NBQ0Y7QUExWkQsZ0RBMFpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgVXRpbCBmcm9tICdhdG9tLWhhc2tlbGwtdXRpbHMnXG5pbXBvcnQgeyBmaWx0ZXIgfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQgeyBDb21tYW5kSGlzdG9yeSB9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHsgR0hDSSwgSVJlcXVlc3RSZXN1bHQgfSBmcm9tICcuL2doY2knXG5pbXBvcnQgKiBhcyBVUEkgZnJvbSAnYXRvbS1oYXNrZWxsLXVwaSdcbmltcG9ydCAqIGFzIEF0b21UeXBlcyBmcm9tICdhdG9tJ1xuaW1wb3J0IHsgVVBJQ29uc3VtZXIgfSBmcm9tICcuL3VwaUNvbnN1bWVyJ1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSwgbm9ybWFsaXplIH0gZnJvbSAncGF0aCdcblxuZXhwb3J0IHsgSVJlcXVlc3RSZXN1bHQgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxuICBmb2N1cz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudEl0ZW0ge1xuICB0ZXh0OiBzdHJpbmdcbiAgY2xzOiBzdHJpbmdcbiAgaGw/OiBib29sZWFuXG4gIGhsY2FjaGU/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIGV4dGVuZHMgVVBJLklSZXN1bHRJdGVtIHtcbiAgX3RpbWU6IG51bWJlclxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgaWYgKGNhYmFsQ29udGVudHMgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWRcbiAgY29uc3Qgbm9UYWJzID0gY2FiYWxDb250ZW50cy5yZXBsYWNlKC9cXHQvZywgJyAgICAgICAgJylcbiAgaWYgKG5vVGFicyAhPT0gY2FiYWxDb250ZW50cykge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgJ1RhYnMgZm91bmQgaW4gQ2FiYWxmaWxlLCByZXBsYWNpbmcgd2l0aCA4IHNwYWNlcycsXG4gICAgICB7XG4gICAgICAgIGRldGFpbDpcbiAgICAgICAgICAnVGFicyBhcmUgbm90IGFsbG93ZWQgYXMgaW5kZW50YXRpb24gY2hhcmFjdGVycyBpbiBDYWJhbGZpbGVzIGR1ZSB0byAnICtcbiAgICAgICAgICAnYSBtaXNzaW5nIHN0YW5kYXJkIGludGVycHJldGF0aW9uIG9mIHRhYiB3aWR0aC4gVGFicyBoYXZlIGJlZW4gJyArXG4gICAgICAgICAgJ2F1dG9tYXRpY2FsbHkgcmVwbGFjZWQgYnkgOCBzcGFjZXMgYXMgcGVyIEhhc2tlbGwgcmVwb3J0IHN0YW5kYXJkLCAnICtcbiAgICAgICAgICAnYnV0IGl0IGlzIGFkdmlzZWQgdG8gYXZvaWQgdXNpbmcgdGFidWxhdGlvbiBpbiBDYWJhbGZpbGUuJyxcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICB9LFxuICAgIClcbiAgfVxuICByZXR1cm4gbm9UYWJzXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENhYmFsRmlsZShcbiAgcm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSxcbik6IFByb21pc2U8QXRvbVR5cGVzLkZpbGVbXT4ge1xuICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJvb3REaXIuZ2V0RW50cmllcygoZXJyb3IsIGNvbnRlbnRzKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKGNvbnRlbnRzKVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgKVxuICByZXR1cm4gY29udC5maWx0ZXIoXG4gICAgKGZpbGUpID0+IGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSxcbiAgKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBhcnNlQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuICBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4gIHVyaTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTx7IGNhYmFsPzogVXRpbC5JRG90Q2FiYWw7IGNvbXBzPzogc3RyaW5nW10gfT4ge1xuICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgcmVhZENhYmFsRmlsZShjYWJhbEZpbGUpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSB1bmRlZmluZWQpIHJldHVybiB7fVxuICBjb25zdCBjYWJhbCA9IGF3YWl0IFV0aWwucGFyc2VEb3RDYWJhbChjYWJhbENvbnRlbnRzKVxuICBsZXQgY29tcHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkXG4gIGlmICh1cmkgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBzID0gYXdhaXQgVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZShjYWJhbENvbnRlbnRzLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICB9XG4gIHJldHVybiB7IGNhYmFsOiBjYWJhbCA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IGNhYmFsLCBjb21wcyB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+XG4gIHByb3RlY3RlZCBnaGNpPzogR0hDSVxuICBwcm90ZWN0ZWQgY3dkPzogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcm90ZWN0ZWQgcHJvbXB0OiBzdHJpbmcgPSAnJ1xuICBwcm90ZWN0ZWQgdXBpPzogVVBJQ29uc3VtZXJcbiAgcHJvdGVjdGVkIG1lc3NhZ2VzOiBJQ29udGVudEl0ZW1bXVxuICBwcm90ZWN0ZWQgZXJyb3JzOiBJRXJyb3JJdGVtW10gPSBbXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcml2YXRlIGVtaXR0ZXIgPSBuZXcgQXRvbVR5cGVzLkVtaXR0ZXI8eyBkZXN0cm95ZWQ6IHZvaWQgfT4oKVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+LFxuICAgIHtcbiAgICAgIHVyaSxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBoaXN0b3J5LFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfTogSVZpZXdTdGF0ZSxcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgZXJyb3JTcm91Y2U6IHN0cmluZyxcbiAgKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gISFhdXRvUmVsb2FkUmVwZWF0XG5cbiAgICB0aGlzLm1lc3NhZ2VzID0gY29udGVudCB8fCBbXVxuXG4gICAgdGhpcy5yZWFkeVByb21pc2UgPSB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpcih1cmk6IHN0cmluZykge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBjb21wb25lbnRGcm9tVVJJKHVyaTogc3RyaW5nKSB7XG4gICAgY29uc3QgY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodXJpKVxuICAgIGNvbnN0IFtjYWJhbEZpbGVdID0gYXdhaXQgZ2V0Q2FiYWxGaWxlKGN3ZClcblxuICAgIGxldCBjb21wOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICBsZXQgY2FiYWw6IFV0aWwuSURvdENhYmFsIHwgdW5kZWZpbmVkXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgY29uc3QgcGFyc2VkID0gYXdhaXQgcGFyc2VDYWJhbEZpbGUoY2FiYWxGaWxlLCBjd2QsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gICAgICBpZiAocGFyc2VkLmNvbXBzKSBjb21wID0gcGFyc2VkLmNvbXBzWzBdXG4gICAgICBpZiAocGFyc2VkLmNhYmFsKSBjYWJhbCA9IHBhcnNlZC5jYWJhbFxuICAgIH1cbiAgICByZXR1cm4geyBjd2QsIGNvbXAsIGNhYmFsIH1cbiAgfVxuXG4gIHB1YmxpYyBhYnN0cmFjdCBhc3luYyB1cGRhdGUocHJvcHM/OiBhbnkpOiBQcm9taXNlPHZvaWQ+XG5cbiAgcHVibGljIG9uRGlkRGVzdHJveShjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICAgIHJldHVybiB0aGlzLmVtaXR0ZXIub24oJ2Rlc3Ryb3llZCcsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQoKSB7XG4gICAgdGhpcy5hdXRvUmVsb2FkUmVwZWF0ID0gIXRoaXMuYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkNvbW1hbmQoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCBpbnAgPSBjb21tYW5kLnNwbGl0KCdcXG4nKVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKGxpbmVJbmZvKSA9PiB7XG4gICAgICBzd2l0Y2ggKGxpbmVJbmZvLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RkaW4nOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiZcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6IGlucC5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgICAgaGw6IHRydWUsXG4gICAgICAgICAgICAgIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDogbGluZUluZm8ubGluZSxcbiAgICAgICAgICAgICAgaGw6IHRydWUsXG4gICAgICAgICAgICAgIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdwcm9tcHQnOlxuICAgICAgICAgIHRoaXMucHJvbXB0ID0gbGluZUluZm8ucHJvbXB0WzFdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gICAgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzpsJykpIGF3YWl0IHRoaXMub25Mb2FkKClcbiAgICBlbHNlIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6cicpKSBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICBlbHNlIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6ZScpKSBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IHsgcHJvbXB0LCBzdGRlcnIgfSA9IGF3YWl0IHRoaXMuZ2hjaS5yZWxvYWQoKVxuICAgIHRoaXMucHJvbXB0ID0gcHJvbXB0WzFdXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICAgIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIHJldHVybiAhdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHN0ZGVycilcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkUmVwZWF0KCkge1xuICAgIGlmIChhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKSkge1xuICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5wZWVrKC0xKVxuICAgICAgaWYgKGNvbW1hbmQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cblxuICBwdWJsaWMgc2V0IGF1dG9SZWxvYWRSZXBlYXQoYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhbikge1xuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldCBhdXRvUmVsb2FkUmVwZWF0KCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMocHJlZml4OiBzdHJpbmcpIHtcbiAgICBpZiAoIXByZWZpeC50cmltKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIGlmICghcmVzKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgcmVzLnN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihyZXMuc3Rkb3V0LCBwcmVmaXgpLm1hcCgodGV4dCkgPT4gKHtcbiAgICAgIHRleHQ6IHRleHQuc2xpY2UoMSwgLTEpLFxuICAgIH0pKVxuICB9XG5cbiAgcHVibGljIGNsZWFyRXJyb3JzKCkge1xuICAgIHRoaXMuc2V0RXJyb3JzKFtdKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblJlbG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jbGVhckVycm9ycygpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSgpIHtcbiAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnZGVzdHJveWVkJylcbiAgICB0aGlzLmNsZWFyRXJyb3JzKClcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGluaXRpYWxpemUodXBpUHJvbWlzZTogUHJvbWlzZTxVUElDb25zdW1lciB8IHVuZGVmaW5lZD4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7XG4gICAgICByZXR1cm4gdGhpcy5ydW5SRVBMKClcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYnVpbGRlciA9IGF3YWl0IHRoaXMudXBpLmdldEJ1aWxkZXIoKVxuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucnVuUkVQTChidWlsZGVyICYmIGJ1aWxkZXIubmFtZSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCBlcnJvciA9IGUgYXMgRXJyb3JcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvci50b1N0cmluZygpLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgICBcImlkZS1oYXNrZWxsLXJlcGw6IENvdWxkbid0IGdldCBidWlsZGVyLiBGYWxsaW5nIGJhY2sgdG8gZGVmYXVsdCBSRVBMXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIClcbiAgICAgIHJldHVybiB0aGlzLnJ1blJFUEwoKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBydW5SRVBMKFxuICAgIGluYnVpbGRlcj86ICdjYWJhbC12MScgfCAnc3RhY2snIHwgJ2NhYmFsLXYyJyB8ICdub25lJyxcbiAgKSB7XG4gICAgbGV0IGJ1aWxkZXIgPSBpbmJ1aWxkZXIgfHwgYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJylcbiAgICBpZiAoIWJ1aWxkZXIpIHRocm93IG5ldyBFcnJvcihgRGVmYXVsdCBSRVBMIG5vdCBzcGVjaWZpZWRgKVxuXG4gICAgY29uc3QgeyBjd2QsIGNvbXAsIGNhYmFsIH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShcbiAgICAgIHRoaXMudXJpLFxuICAgIClcbiAgICB0aGlzLmN3ZCA9IGN3ZFxuXG4gICAgbGV0IGNvbW1hbmRQYXRoOiBzdHJpbmdcbiAgICBsZXQgY29tbWFuZEFyZ3M6IHN0cmluZ1tdXG4gICAgbGV0IGV4dHJhQXJnczogKHg6IHN0cmluZykgPT4gc3RyaW5nXG4gICAgc3dpdGNoIChidWlsZGVyKSB7XG4gICAgICBjYXNlICdjYWJhbC12MSc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsJykubGVnYWN5Q2FiYWxWMVxuICAgICAgICAgID8gWydyZXBsJ11cbiAgICAgICAgICA6IFsndjEtcmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2NhYmFsLXYyJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbJ3YyLXJlcGwnXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdzdGFjayc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gWydnaGNpJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZ2hjaSc6XG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFtdXG4gICAgICAgIGV4dHJhQXJncyA9ICh4KSA9PiB4XG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbGRlciAke2J1aWxkZXJ9YClcbiAgICB9XG5cbiAgICBjb25zdCBleHRyYUFyZ3NMaXN0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpIHx8IFtdXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi5leHRyYUFyZ3NMaXN0Lm1hcChleHRyYUFyZ3MpKVxuXG4gICAgaWYgKGNvbXAgJiYgY2FiYWwpIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGNvbnN0IGNvbXBjID0gY29tcC5zdGFydHNXaXRoKCdsaWI6JykgPyAnbGliJyA6IGNvbXBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChgJHtjYWJhbC5uYW1lfToke2NvbXBjfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGNvbXApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jICgpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKGluaXRyZXMuc3RkZXJyLCB0cnVlKVxuICAgIHJldHVybiB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVycihcbiAgICBzdGRlcnI6IHN0cmluZ1tdLFxuICAgIGZpbHRlckluaXRXYXJuaW5ncyA9IGZhbHNlLFxuICApOiBib29sZWFuIHtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmVycm9yc1xuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGxldCBuZXdNZXNzYWdlcyA9IGZhbHNlXG4gICAgbGV0IG5ld0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnIgb2Ygc3RkZXJyXG4gICAgICAuZmlsdGVyKCh4KSA9PiAhL15cXHMqXFxkKiBcXHwvLnRlc3QoeCkpXG4gICAgICAuam9pbignXFxuJylcbiAgICAgIC5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBmaWx0ZXJJbml0V2FybmluZ3MgJiZcbiAgICAgICAgICAgIGVycm9yLnNldmVyaXR5ID09PSAncmVwbCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBlcnJvci5tZXNzYWdlID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgZXJyb3IubWVzc2FnZS5tYXRjaChcbiAgICAgICAgICAgICAgL15Tb21lIGZsYWdzIGhhdmUgbm90IGJlZW4gcmVjb2duaXplZDogKD86KD86cHJvbXB0Mnxwcm9tcHQtY29udCksXFxzKikrXFxzKi8sXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGVycm9ycy5wdXNoKGVycm9yKVxuICAgICAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ2Vycm9yJykgaGFzRXJyb3JzID0gdHJ1ZVxuXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAncmVwbCcpIG5ld01lc3NhZ2VzID0gdHJ1ZVxuICAgICAgICAgIGVsc2UgbmV3RXJyb3JzID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMuc2V0RXJyb3JzKGVycm9ycywgbmV3RXJyb3JzLCBuZXdNZXNzYWdlcylcbiAgICByZXR1cm4gaGFzRXJyb3JzXG4gIH1cblxuICBwcm90ZWN0ZWQgdW5pbmRlbnRNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgbGV0IGxpbmVzID0gbWVzc2FnZS5zcGxpdCgnXFxuJykuZmlsdGVyKCh4KSA9PiAheC5tYXRjaCgvXlxccyokLykpXG4gICAgbGV0IG1pbkluZGVudDogbnVtYmVyIHwgdW5kZWZpbmVkXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqLylcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBjb25zdCBsaW5lSW5kZW50ID0gbWF0Y2hbMF0ubGVuZ3RoXG4gICAgICAgIGlmICghbWluSW5kZW50IHx8IGxpbmVJbmRlbnQgPCBtaW5JbmRlbnQpIHtcbiAgICAgICAgICBtaW5JbmRlbnQgPSBsaW5lSW5kZW50XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1pbkluZGVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBtaSA9IG1pbkluZGVudFxuICAgICAgbGluZXMgPSBsaW5lcy5tYXAoKGxpbmUpID0+IGxpbmUuc2xpY2UobWkpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByb3RlY3RlZCBwYXJzZU1lc3NhZ2UocmF3OiBzdHJpbmcpOiBJRXJyb3JJdGVtIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMuY3dkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIGNvbnN0IG1hdGNoTG9jID0gL14oLispOihcXGQrKTooXFxkKyk6KD86IChcXHcrKTopP1sgXFx0XSooXFxbW15cXF1dK1xcXSk/WyBcXHRdKlxcbj8oW15dKikvXG4gICAgaWYgKHJhdyAmJiByYXcudHJpbSgpICE9PSAnJykge1xuICAgICAgY29uc3QgbWF0Y2hlZCA9IHJhdy5tYXRjaChtYXRjaExvYylcbiAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgIGNvbnN0IFtmaWxlYywgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHQsIG1zZ106IEFycmF5PFxuICAgICAgICAgIHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICA+ID0gbWF0Y2hlZC5zbGljZSgxKVxuICAgICAgICBsZXQgdHlwOiBVUEkuVFNldmVyaXR5ID0gcmF3VHlwID8gcmF3VHlwLnRvTG93ZXJDYXNlKCkgOiAnZXJyb3InXG4gICAgICAgIGxldCBmaWxlOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgICAgaWYgKGZpbGVjID09PSAnPGludGVyYWN0aXZlPicpIHtcbiAgICAgICAgICBmaWxlID0gdW5kZWZpbmVkXG4gICAgICAgICAgdHlwID0gJ3JlcGwnXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmlsZSA9IGZpbGVjXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVyaTogZmlsZVxuICAgICAgICAgICAgPyBpc0Fic29sdXRlKGZpbGUpXG4gICAgICAgICAgICAgID8gbm9ybWFsaXplKGZpbGUpXG4gICAgICAgICAgICAgIDogdGhpcy5jd2QuZ2V0RmlsZShmaWxlKS5nZXRQYXRoKClcbiAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgIHBvc2l0aW9uOiBbXG4gICAgICAgICAgICBwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSxcbiAgICAgICAgICAgIHBhcnNlSW50KGNvbCBhcyBzdHJpbmcsIDEwKSAtIDEsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnVuaW5kZW50TWVzc2FnZShcbiAgICAgICAgICAgICAgKG1zZyBhcyBzdHJpbmcgJiB7IHRyaW1SaWdodCgpOiBzdHJpbmcgfSkudHJpbVJpZ2h0KCksXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgaGlnaGxpZ2h0ZXI6ICdoaW50Lm1lc3NhZ2UuaGFza2VsbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgIHNldmVyaXR5OiB0eXAsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbWVzc2FnZTogcmF3LFxuICAgICAgICAgIHNldmVyaXR5OiAncmVwbCcsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2V0RXJyb3JzKFxuICAgIGVycm9yczogSUVycm9ySXRlbVtdLFxuICAgIG5ld0Vycm9ycyA9IHRydWUsXG4gICAgbmV3TWVzc2FnZXMgPSB0cnVlLFxuICApIHtcbiAgICB0aGlzLmVycm9ycyA9IGVycm9yc1xuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgaWYgKG5ld01lc3NhZ2VzKSB7XG4gICAgICAgIHRoaXMudXBpLnNldE1lc3NhZ2VzKFxuICAgICAgICAgIHRoaXMuZXJyb3JzLmZpbHRlcigoeyBzZXZlcml0eSB9KSA9PiBzZXZlcml0eSA9PT0gJ3JlcGwnKSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgaWYgKG5ld0Vycm9ycykge1xuICAgICAgICB0aGlzLnVwaS5zZXRFcnJvcnMoXG4gICAgICAgICAgdGhpcy5lcnJvclNyb3VjZSxcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgIT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICB9XG59XG4iXX0=