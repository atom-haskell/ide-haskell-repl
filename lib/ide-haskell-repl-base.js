"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
const AtomTypes = require("atom");
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
            case 'cabal':
                commandPath = atom.config.get('ide-haskell-repl.cabalPath');
                commandArgs = ['repl'];
                extraArgs = (x) => `--ghc-option=${x}`;
                break;
            case 'cabal-nix':
            case 'cabal-new':
                commandPath = atom.config.get('ide-haskell-repl.cabalPath');
                commandArgs = ['new-repl'];
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
        this.errorsFromStderr(initres.stderr);
        return this.update();
    }
    errorsFromStderr(stderr) {
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
                        ? this.cwd.getFile(this.cwd.relativize(file)).getPath()
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUF3QmpDLEtBQUssVUFBVSxhQUFhLENBQzFCLFNBQXlCO0lBRXpCLE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO0lBQzVDLElBQUksYUFBYSxLQUFLLElBQUk7UUFBRSxPQUFPLFNBQVMsQ0FBQTtJQUM1QyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQTtJQUN2RCxJQUFJLE1BQU0sS0FBSyxhQUFhLEVBQUU7UUFDNUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQzNCLGtEQUFrRCxFQUNsRDtZQUNFLE1BQU0sRUFDSixzRUFBc0U7Z0JBQ3RFLGlFQUFpRTtnQkFDakUscUVBQXFFO2dCQUNyRSwyREFBMkQ7WUFDN0QsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FDRixDQUFBO0tBQ0Y7SUFDRCxPQUFPLE1BQU0sQ0FBQTtBQUNmLENBQUM7QUFFRCxLQUFLLFVBQVUsWUFBWSxDQUN6QixPQUE0QjtJQUU1QixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksT0FBTyxDQUM1QixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUNsQixPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFO1FBQ3JDLElBQUksS0FBSyxFQUFFO1lBQ1QsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO1NBQ2Q7YUFBTTtZQUNMLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtTQUNsQjtJQUNILENBQUMsQ0FBQyxDQUNMLENBQUE7SUFDRCxP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LEtBQUssTUFBTSxDQUFDLENBQzFELENBQUE7YUFDRjtZQUNELElBQUksU0FBUyxFQUFFO2dCQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUNoQixJQUFJLENBQUMsV0FBVyxFQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FDMUQsQ0FBQTthQUNGO1NBQ0Y7YUFBTTtZQUVMLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtTQUNkO0lBQ0gsQ0FBQztDQUNGO0FBellELGdEQXlZQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAnZnV6emFsZHJpbidcblxuaW1wb3J0IHsgQ29tbWFuZEhpc3RvcnkgfSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7IEdIQ0ksIElSZXF1ZXN0UmVzdWx0IH0gZnJvbSAnLi9naGNpJ1xuaW1wb3J0ICogYXMgVVBJIGZyb20gJ2F0b20taGFza2VsbC11cGknXG5pbXBvcnQgKiBhcyBBdG9tVHlwZXMgZnJvbSAnYXRvbSdcbmltcG9ydCB7IFVQSUNvbnN1bWVyIH0gZnJvbSAnLi91cGlDb25zdW1lcidcblxuZXhwb3J0IHsgSVJlcXVlc3RSZXN1bHQgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxuICBmb2N1cz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudEl0ZW0ge1xuICB0ZXh0OiBzdHJpbmdcbiAgY2xzOiBzdHJpbmdcbiAgaGw/OiBib29sZWFuXG4gIGhsY2FjaGU/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIGV4dGVuZHMgVVBJLklSZXN1bHRJdGVtIHtcbiAgX3RpbWU6IG51bWJlclxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgaWYgKGNhYmFsQ29udGVudHMgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWRcbiAgY29uc3Qgbm9UYWJzID0gY2FiYWxDb250ZW50cy5yZXBsYWNlKC9cXHQvZywgJyAgICAgICAgJylcbiAgaWYgKG5vVGFicyAhPT0gY2FiYWxDb250ZW50cykge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFxuICAgICAgJ1RhYnMgZm91bmQgaW4gQ2FiYWxmaWxlLCByZXBsYWNpbmcgd2l0aCA4IHNwYWNlcycsXG4gICAgICB7XG4gICAgICAgIGRldGFpbDpcbiAgICAgICAgICAnVGFicyBhcmUgbm90IGFsbG93ZWQgYXMgaW5kZW50YXRpb24gY2hhcmFjdGVycyBpbiBDYWJhbGZpbGVzIGR1ZSB0byAnICtcbiAgICAgICAgICAnYSBtaXNzaW5nIHN0YW5kYXJkIGludGVycHJldGF0aW9uIG9mIHRhYiB3aWR0aC4gVGFicyBoYXZlIGJlZW4gJyArXG4gICAgICAgICAgJ2F1dG9tYXRpY2FsbHkgcmVwbGFjZWQgYnkgOCBzcGFjZXMgYXMgcGVyIEhhc2tlbGwgcmVwb3J0IHN0YW5kYXJkLCAnICtcbiAgICAgICAgICAnYnV0IGl0IGlzIGFkdmlzZWQgdG8gYXZvaWQgdXNpbmcgdGFidWxhdGlvbiBpbiBDYWJhbGZpbGUuJyxcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICB9LFxuICAgIClcbiAgfVxuICByZXR1cm4gbm9UYWJzXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENhYmFsRmlsZShcbiAgcm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSxcbik6IFByb21pc2U8QXRvbVR5cGVzLkZpbGVbXT4ge1xuICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgIHJvb3REaXIuZ2V0RW50cmllcygoZXJyb3IsIGNvbnRlbnRzKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNvbHZlKGNvbnRlbnRzKVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgKVxuICByZXR1cm4gY29udC5maWx0ZXIoXG4gICAgKGZpbGUpID0+IGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSxcbiAgKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBhcnNlQ2FiYWxGaWxlKFxuICBjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLFxuICBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4gIHVyaTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTx7IGNhYmFsPzogVXRpbC5JRG90Q2FiYWw7IGNvbXBzPzogc3RyaW5nW10gfT4ge1xuICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgcmVhZENhYmFsRmlsZShjYWJhbEZpbGUpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSB1bmRlZmluZWQpIHJldHVybiB7fVxuICBjb25zdCBjYWJhbCA9IGF3YWl0IFV0aWwucGFyc2VEb3RDYWJhbChjYWJhbENvbnRlbnRzKVxuICBsZXQgY29tcHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkXG4gIGlmICh1cmkgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbXBzID0gYXdhaXQgVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZShjYWJhbENvbnRlbnRzLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICB9XG4gIHJldHVybiB7IGNhYmFsOiBjYWJhbCA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IGNhYmFsLCBjb21wcyB9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+XG4gIHByb3RlY3RlZCBnaGNpPzogR0hDSVxuICBwcm90ZWN0ZWQgY3dkPzogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcm90ZWN0ZWQgcHJvbXB0OiBzdHJpbmcgPSAnJ1xuICBwcm90ZWN0ZWQgdXBpPzogVVBJQ29uc3VtZXJcbiAgcHJvdGVjdGVkIG1lc3NhZ2VzOiBJQ29udGVudEl0ZW1bXVxuICBwcm90ZWN0ZWQgZXJyb3JzOiBJRXJyb3JJdGVtW10gPSBbXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcml2YXRlIGVtaXR0ZXIgPSBuZXcgQXRvbVR5cGVzLkVtaXR0ZXI8eyBkZXN0cm95ZWQ6IHZvaWQgfT4oKVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+LFxuICAgIHtcbiAgICAgIHVyaSxcbiAgICAgIGNvbnRlbnQsXG4gICAgICBoaXN0b3J5LFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfTogSVZpZXdTdGF0ZSxcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgZXJyb3JTcm91Y2U6IHN0cmluZyxcbiAgKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gISFhdXRvUmVsb2FkUmVwZWF0XG5cbiAgICB0aGlzLm1lc3NhZ2VzID0gY29udGVudCB8fCBbXVxuXG4gICAgdGhpcy5yZWFkeVByb21pc2UgPSB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpcih1cmk6IHN0cmluZykge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBjb21wb25lbnRGcm9tVVJJKHVyaTogc3RyaW5nKSB7XG4gICAgY29uc3QgY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodXJpKVxuICAgIGNvbnN0IFtjYWJhbEZpbGVdID0gYXdhaXQgZ2V0Q2FiYWxGaWxlKGN3ZClcblxuICAgIGxldCBjb21wOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICBsZXQgY2FiYWw6IFV0aWwuSURvdENhYmFsIHwgdW5kZWZpbmVkXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgY29uc3QgcGFyc2VkID0gYXdhaXQgcGFyc2VDYWJhbEZpbGUoY2FiYWxGaWxlLCBjd2QsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gICAgICBpZiAocGFyc2VkLmNvbXBzKSBjb21wID0gcGFyc2VkLmNvbXBzWzBdXG4gICAgICBpZiAocGFyc2VkLmNhYmFsKSBjYWJhbCA9IHBhcnNlZC5jYWJhbFxuICAgIH1cbiAgICByZXR1cm4geyBjd2QsIGNvbXAsIGNhYmFsIH1cbiAgfVxuXG4gIHB1YmxpYyBhYnN0cmFjdCBhc3luYyB1cGRhdGUoKTogUHJvbWlzZTx2b2lkPlxuXG4gIHB1YmxpYyBvbkRpZERlc3Ryb3koY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICByZXR1cm4gdGhpcy5lbWl0dGVyLm9uKCdkZXN0cm95ZWQnLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyB0b2dnbGVBdXRvUmVsb2FkUmVwZWF0KCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICF0aGlzLmF1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBydW5Db21tYW5kKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgaW5wID0gY29tbWFuZC5zcGxpdCgnXFxuJylcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhpbnAsIChsaW5lSW5mbykgPT4ge1xuICAgICAgc3dpdGNoIChsaW5lSW5mby50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0ZGluJzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OiBpbnAuam9pbignXFxuJyksXG4gICAgICAgICAgICAgIGhsOiB0cnVlLFxuICAgICAgICAgICAgICBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdzdGRvdXQnOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiZcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6IGxpbmVJbmZvLmxpbmUsXG4gICAgICAgICAgICAgIGhsOiB0cnVlLFxuICAgICAgICAgICAgICBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLW91dHB1dC10ZXh0JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IGxpbmVJbmZvLnByb21wdFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICAgIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6bCcpKSBhd2FpdCB0aGlzLm9uTG9hZCgpXG4gICAgZWxzZSBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOnInKSkgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgZWxzZSBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOmUnKSkgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCB7IHByb21wdCwgc3RkZXJyIH0gPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLnByb21wdCA9IHByb21wdFsxXVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgICBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gIXRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCgpIHtcbiAgICBpZiAoYXdhaXQgdGhpcy5naGNpUmVsb2FkKCkpIHtcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSB0aGlzLmhpc3RvcnkucGVlaygtMSlcbiAgICAgIGlmIChjb21tYW5kKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoY29tbWFuZClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG5cbiAgcHVibGljIHNldCBhdXRvUmVsb2FkUmVwZWF0KGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYXV0b1JlbG9hZFJlcGVhdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMuZ2hjaS5pbnRlcnJ1cHQoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbXBsZXRpb25zKHByZWZpeDogc3RyaW5nKSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kuc2VuZENvbXBsZXRpb25SZXF1ZXN0KClcbiAgICBpZiAoIXJlcykgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHJlcy5zdGRvdXQuc2hpZnQoKVxuICAgIHJldHVybiBmaWx0ZXIocmVzLnN0ZG91dCwgcHJlZml4KS5tYXAoKHRleHQpID0+ICh7XG4gICAgICB0ZXh0OiB0ZXh0LnNsaWNlKDEsIC0xKSxcbiAgICB9KSlcbiAgfVxuXG4gIHB1YmxpYyBjbGVhckVycm9ycygpIHtcbiAgICB0aGlzLnNldEVycm9ycyhbXSlcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZWxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xlYXJFcnJvcnMoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2Rlc3Ryb3llZCcpXG4gICAgdGhpcy5jbGVhckVycm9ycygpXG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplKHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+KSB7XG4gICAgdGhpcy51cGkgPSBhd2FpdCB1cGlQcm9taXNlXG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIHRoaXMucnVuUkVQTCgpXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5nZXRCdWlsZGVyKClcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJ1blJFUEwoYnVpbGRlciAmJiBidWlsZGVyLm5hbWUpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc3QgZXJyb3IgPSBlIGFzIEVycm9yXG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICAgXCJpZGUtaGFza2VsbC1yZXBsOiBDb3VsZG4ndCBnZXQgYnVpbGRlci4gRmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgUkVQTFwiLFxuICAgICAgICB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICApXG4gICAgICByZXR1cm4gdGhpcy5ydW5SRVBMKClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTChcbiAgICBpbmJ1aWxkZXI/OiAnY2FiYWwnIHwgJ3N0YWNrJyB8ICdjYWJhbC1uaXgnIHwgJ25vbmUnLFxuICApIHtcbiAgICBjb25zdCBidWlsZGVyID0gaW5idWlsZGVyIHx8IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpXG4gICAgaWYgKCFidWlsZGVyKSB0aHJvdyBuZXcgRXJyb3IoYERlZmF1bHQgUkVQTCBub3Qgc3BlY2lmaWVkYClcblxuICAgIGNvbnN0IHsgY3dkLCBjb21wLCBjYWJhbCB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoXG4gICAgICB0aGlzLnVyaSxcbiAgICApXG4gICAgdGhpcy5jd2QgPSBjd2RcblxuICAgIGxldCBjb21tYW5kUGF0aDogc3RyaW5nXG4gICAgbGV0IGNvbW1hbmRBcmdzOiBzdHJpbmdbXVxuICAgIGxldCBleHRyYUFyZ3M6ICh4OiBzdHJpbmcpID0+IHN0cmluZ1xuICAgIHN3aXRjaCAoYnVpbGRlcikge1xuICAgICAgY2FzZSAnY2FiYWwnOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jYWJhbFBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFsncmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2NhYmFsLW5peCc6XG4gICAgICBjYXNlICdjYWJhbC1uZXcnOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jYWJhbFBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFsnbmV3LXJlcGwnXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdzdGFjayc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gWydnaGNpJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZ2hjaSc6XG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFtdXG4gICAgICAgIGV4dHJhQXJncyA9ICh4KSA9PiB4XG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbGRlciAke2J1aWxkZXJ9YClcbiAgICB9XG5cbiAgICBjb25zdCBleHRyYUFyZ3NMaXN0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpIHx8IFtdXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi5leHRyYUFyZ3NMaXN0Lm1hcChleHRyYUFyZ3MpKVxuXG4gICAgaWYgKGNvbXAgJiYgY2FiYWwpIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGNvbnN0IGNvbXBjID0gY29tcC5zdGFydHNXaXRoKCdsaWI6JykgPyAnbGliJyA6IGNvbXBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChgJHtjYWJhbC5uYW1lfToke2NvbXBjfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGNvbXApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jICgpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKGluaXRyZXMuc3RkZXJyKVxuICAgIHJldHVybiB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVycihzdGRlcnI6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZXJyb3JzID0gdGhpcy5lcnJvcnNcbiAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2VcbiAgICBsZXQgbmV3TWVzc2FnZXMgPSBmYWxzZVxuICAgIGxldCBuZXdFcnJvcnMgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgZXJyIG9mIHN0ZGVyclxuICAgICAgLmZpbHRlcigoeCkgPT4gIS9eXFxzKlxcZCogXFx8Ly50ZXN0KHgpKVxuICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICAuc3BsaXQoL1xcbig/PVxcUykvKSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjb25zdCBlcnJvciA9IHRoaXMucGFyc2VNZXNzYWdlKGVycilcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSBoYXNFcnJvcnMgPSB0cnVlXG5cbiAgICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdyZXBsJykgbmV3TWVzc2FnZXMgPSB0cnVlXG4gICAgICAgICAgZWxzZSBuZXdFcnJvcnMgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy5zZXRFcnJvcnMoZXJyb3JzLCBuZXdFcnJvcnMsIG5ld01lc3NhZ2VzKVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50OiBudW1iZXIgfCB1bmRlZmluZWRcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgaWYgKCFtaW5JbmRlbnQgfHwgbGluZUluZGVudCA8IG1pbkluZGVudCkge1xuICAgICAgICAgIG1pbkluZGVudCA9IGxpbmVJbmRlbnRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobWluSW5kZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1pID0gbWluSW5kZW50XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaSkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZShyYXc6IHN0cmluZyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5jd2QpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/WyBcXHRdKihcXFtbXlxcXV0rXFxdKT9bIFxcdF0qXFxuPyhbXl0qKS9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgW2ZpbGVjLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dCwgbXNnXTogQXJyYXk8XG4gICAgICAgICAgc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgID4gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFVQSS5UU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlXG4gICAgICAgICAgICA/IHRoaXMuY3dkLmdldEZpbGUodGhpcy5jd2QucmVsYXRpdml6ZShmaWxlKSkuZ2V0UGF0aCgpXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwb3NpdGlvbjogW1xuICAgICAgICAgICAgcGFyc2VJbnQobGluZSBhcyBzdHJpbmcsIDEwKSAtIDEsXG4gICAgICAgICAgICBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UoXG4gICAgICAgICAgICAgIChtc2cgYXMgc3RyaW5nICYgeyB0cmltUmlnaHQoKTogc3RyaW5nIH0pLnRyaW1SaWdodCgpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNldEVycm9ycyhcbiAgICBlcnJvcnM6IElFcnJvckl0ZW1bXSxcbiAgICBuZXdFcnJvcnMgPSB0cnVlLFxuICAgIG5ld01lc3NhZ2VzID0gdHJ1ZSxcbiAgKSB7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnNcbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIGlmIChuZXdNZXNzYWdlcykge1xuICAgICAgICB0aGlzLnVwaS5zZXRNZXNzYWdlcyhcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgPT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChuZXdFcnJvcnMpIHtcbiAgICAgICAgdGhpcy51cGkuc2V0RXJyb3JzKFxuICAgICAgICAgIHRoaXMuZXJyb3JTcm91Y2UsXG4gICAgICAgICAgdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ICE9PSAncmVwbCcpLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH1cbiAgfVxufVxuIl19