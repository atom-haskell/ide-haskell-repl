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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBdUI1QyxLQUFLLFVBQVUsYUFBYSxDQUMxQixTQUF5QjtJQUV6QixNQUFNLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUM1QyxJQUFJLGFBQWEsS0FBSyxJQUFJO1FBQUUsT0FBTyxTQUFTLENBQUE7SUFDNUMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUE7SUFDdkQsSUFBSSxNQUFNLEtBQUssYUFBYSxFQUFFO1FBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUMzQixrREFBa0QsRUFDbEQ7WUFDRSxNQUFNLEVBQ0osc0VBQXNFO2dCQUN0RSxpRUFBaUU7Z0JBQ2pFLHFFQUFxRTtnQkFDckUsMkRBQTJEO1lBQzdELFdBQVcsRUFBRSxJQUFJO1NBQ2xCLENBQ0YsQ0FBQTtLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUE7QUFDZixDQUFDO0FBRUQsS0FBSyxVQUFVLFlBQVksQ0FDekIsT0FBNEI7SUFFNUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDbEIsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtRQUNyQyxJQUFJLEtBQUssRUFBRTtZQUNULE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtTQUNkO2FBQU07WUFDTCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7U0FDbEI7SUFDSCxDQUFDLENBQUMsQ0FD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LEVBQUU7WUFDWixJQUFJLFdBQVcsRUFBRTtnQkFDZixJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FDbEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFDLENBQzFELENBQUE7YUFDRjtZQUNELElBQUksU0FBUyxFQUFFO2dCQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUNoQixJQUFJLENBQUMsV0FBVyxFQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FDMUQsQ0FBQTthQUNGO1NBQ0Y7YUFBTTtZQUVMLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtTQUNkO0lBQ0gsQ0FBQztDQUNGO0FBNVlELGdEQTRZQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAnZnV6emFsZHJpbidcblxuaW1wb3J0IHsgQ29tbWFuZEhpc3RvcnkgfSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7IEdIQ0ksIElSZXF1ZXN0UmVzdWx0IH0gZnJvbSAnLi9naGNpJ1xuaW1wb3J0ICogYXMgVVBJIGZyb20gJ2F0b20taGFza2VsbC11cGknXG5pbXBvcnQgKiBhcyBBdG9tVHlwZXMgZnJvbSAnYXRvbSdcbmltcG9ydCB7IFVQSUNvbnN1bWVyIH0gZnJvbSAnLi91cGlDb25zdW1lcidcbmltcG9ydCB7IGlzQWJzb2x1dGUsIG5vcm1hbGl6ZSB9IGZyb20gJ3BhdGgnXG5cbmV4cG9ydCB7IElSZXF1ZXN0UmVzdWx0IH1cblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1N0YXRlIHtcbiAgdXJpPzogc3RyaW5nXG4gIGhpc3Rvcnk/OiBzdHJpbmdbXVxuICBhdXRvUmVsb2FkUmVwZWF0PzogYm9vbGVhblxuICBjb250ZW50PzogSUNvbnRlbnRJdGVtW11cbiAgZm9jdXM/OiBib29sZWFuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxuICBobGNhY2hlPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSBleHRlbmRzIFVQSS5JUmVzdWx0SXRlbSB7XG4gIF90aW1lOiBudW1iZXJcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZENhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IGNhYmFsQ29udGVudHMgPSBhd2FpdCBjYWJhbEZpbGUucmVhZCgpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkXG4gIGNvbnN0IG5vVGFicyA9IGNhYmFsQ29udGVudHMucmVwbGFjZSgvXFx0L2csICcgICAgICAgICcpXG4gIGlmIChub1RhYnMgIT09IGNhYmFsQ29udGVudHMpIHtcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICdUYWJzIGZvdW5kIGluIENhYmFsZmlsZSwgcmVwbGFjaW5nIHdpdGggOCBzcGFjZXMnLFxuICAgICAge1xuICAgICAgICBkZXRhaWw6XG4gICAgICAgICAgJ1RhYnMgYXJlIG5vdCBhbGxvd2VkIGFzIGluZGVudGF0aW9uIGNoYXJhY3RlcnMgaW4gQ2FiYWxmaWxlcyBkdWUgdG8gJyArXG4gICAgICAgICAgJ2EgbWlzc2luZyBzdGFuZGFyZCBpbnRlcnByZXRhdGlvbiBvZiB0YWIgd2lkdGguIFRhYnMgaGF2ZSBiZWVuICcgK1xuICAgICAgICAgICdhdXRvbWF0aWNhbGx5IHJlcGxhY2VkIGJ5IDggc3BhY2VzIGFzIHBlciBIYXNrZWxsIHJlcG9ydCBzdGFuZGFyZCwgJyArXG4gICAgICAgICAgJ2J1dCBpdCBpcyBhZHZpc2VkIHRvIGF2b2lkIHVzaW5nIHRhYnVsYXRpb24gaW4gQ2FiYWxmaWxlLicsXG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICApXG4gIH1cbiAgcmV0dXJuIG5vVGFic1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDYWJhbEZpbGUoXG4gIHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4pOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgY29uc3QgY29udCA9IGF3YWl0IG5ldyBQcm9taXNlPEFycmF5PEF0b21UeXBlcy5EaXJlY3RvcnkgfCBBdG9tVHlwZXMuRmlsZT4+KFxuICAgIChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gIClcbiAgcmV0dXJuIGNvbnQuZmlsdGVyKFxuICAgIChmaWxlKSA9PiBmaWxlLmlzRmlsZSgpICYmIGZpbGUuZ2V0QmFzZU5hbWUoKS5lbmRzV2l0aCgnLmNhYmFsJyksXG4gICkgYXMgQXRvbVR5cGVzLkZpbGVbXVxufVxuXG5hc3luYyBmdW5jdGlvbiBwYXJzZUNhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbiAgY3dkOiBBdG9tVHlwZXMuRGlyZWN0b3J5LFxuICB1cmk6IHN0cmluZyB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8eyBjYWJhbD86IFV0aWwuSURvdENhYmFsOyBjb21wcz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IHJlYWRDYWJhbEZpbGUoY2FiYWxGaWxlKVxuICBpZiAoY2FiYWxDb250ZW50cyA9PT0gdW5kZWZpbmVkKSByZXR1cm4ge31cbiAgY29uc3QgY2FiYWwgPSBhd2FpdCBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgbGV0IGNvbXBzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZFxuICBpZiAodXJpICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb21wcyA9IGF3YWl0IFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGUoY2FiYWxDb250ZW50cywgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgfVxuICByZXR1cm4geyBjYWJhbDogY2FiYWwgPT09IG51bGwgPyB1bmRlZmluZWQgOiBjYWJhbCwgY29tcHMgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlYWR5UHJvbWlzZTogUHJvbWlzZTx2b2lkPlxuICBwcm90ZWN0ZWQgZ2hjaT86IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZD86IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nID0gJydcbiAgcHJvdGVjdGVkIHVwaT86IFVQSUNvbnN1bWVyXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdID0gW11cbiAgcHJvdGVjdGVkIF9hdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByb3RlY3RlZCBoaXN0b3J5OiBDb21tYW5kSGlzdG9yeVxuICBwcm90ZWN0ZWQgdXJpOiBzdHJpbmdcbiAgcHJpdmF0ZSBlbWl0dGVyID0gbmV3IEF0b21UeXBlcy5FbWl0dGVyPHsgZGVzdHJveWVkOiB2b2lkIH0+KClcblxuICBjb25zdHJ1Y3RvcihcbiAgICB1cGlQcm9taXNlOiBQcm9taXNlPFVQSUNvbnN1bWVyIHwgdW5kZWZpbmVkPixcbiAgICB7XG4gICAgICB1cmksXG4gICAgICBjb250ZW50LFxuICAgICAgaGlzdG9yeSxcbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH06IElWaWV3U3RhdGUsXG4gICAgcHJvdGVjdGVkIHJlYWRvbmx5IGVycm9yU3JvdWNlOiBzdHJpbmcsXG4gICkge1xuICAgIHRoaXMudXJpID0gdXJpIHx8ICcnXG4gICAgdGhpcy5oaXN0b3J5ID0gbmV3IENvbW1hbmRIaXN0b3J5KGhpc3RvcnkpXG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9ICEhYXV0b1JlbG9hZFJlcGVhdFxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHRoaXMucmVhZHlQcm9taXNlID0gdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFJvb3REaXIodXJpOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gVXRpbC5nZXRSb290RGlyKHVyaSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgY29tcG9uZW50RnJvbVVSSSh1cmk6IHN0cmluZykge1xuICAgIGNvbnN0IGN3ZCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRSb290RGlyKHVyaSlcbiAgICBjb25zdCBbY2FiYWxGaWxlXSA9IGF3YWl0IGdldENhYmFsRmlsZShjd2QpXG5cbiAgICBsZXQgY29tcDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgbGV0IGNhYmFsOiBVdGlsLklEb3RDYWJhbCB8IHVuZGVmaW5lZFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGNvbnN0IHBhcnNlZCA9IGF3YWl0IHBhcnNlQ2FiYWxGaWxlKGNhYmFsRmlsZSwgY3dkLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICAgICAgaWYgKHBhcnNlZC5jb21wcykgY29tcCA9IHBhcnNlZC5jb21wc1swXVxuICAgICAgaWYgKHBhcnNlZC5jYWJhbCkgY2FiYWwgPSBwYXJzZWQuY2FiYWxcbiAgICB9XG4gICAgcmV0dXJuIHsgY3dkLCBjb21wLCBjYWJhbCB9XG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgYXN5bmMgdXBkYXRlKCk6IFByb21pc2U8dm9pZD5cblxuICBwdWJsaWMgb25EaWREZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZW1pdHRlci5vbignZGVzdHJveWVkJywgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCgpIHtcbiAgICB0aGlzLmF1dG9SZWxvYWRSZXBlYXQgPSAhdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAobGluZUluZm8pID0+IHtcbiAgICAgIHN3aXRjaCAobGluZUluZm8udHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJlxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OiBsaW5lSW5mby5saW5lLFxuICAgICAgICAgICAgICBobDogdHJ1ZSxcbiAgICAgICAgICAgICAgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCcsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSBsaW5lSW5mby5wcm9tcHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgICBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOmwnKSkgYXdhaXQgdGhpcy5vbkxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzpyJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIGVsc2UgaWYgKGNvbW1hbmQudHJpbSgpLnN0YXJ0c1dpdGgoJzplJykpIGF3YWl0IHRoaXMub25SZWxvYWQoKVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgeyBwcm9tcHQsIHN0ZGVyciB9ID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5wcm9tcHQgPSBwcm9tcHRbMV1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gICAgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuICF0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQoKSB7XG4gICAgaWYgKGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LnBlZWsoLTEpXG4gICAgICBpZiAoY29tbWFuZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyhwcmVmaXg6IHN0cmluZykge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgaWYgKCFyZXMpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXMuc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHJlcy5zdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe1xuICAgICAgdGV4dDogdGV4dC5zbGljZSgxLCAtMSksXG4gICAgfSkpXG4gIH1cblxuICBwdWJsaWMgY2xlYXJFcnJvcnMoKSB7XG4gICAgdGhpcy5zZXRFcnJvcnMoW10pXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uUmVsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkKCkge1xuICAgIHJldHVybiB0aGlzLmNsZWFyRXJyb3JzKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95KCkge1xuICAgIHRoaXMuZW1pdHRlci5lbWl0KCdkZXN0cm95ZWQnKVxuICAgIHRoaXMuY2xlYXJFcnJvcnMoKVxuICAgIGlmICh0aGlzLmdoY2kpIHtcbiAgICAgIHRoaXMuZ2hjaS5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaW5pdGlhbGl6ZSh1cGlQcm9taXNlOiBQcm9taXNlPFVQSUNvbnN1bWVyIHwgdW5kZWZpbmVkPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiB0aGlzLnJ1blJFUEwoKVxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkuZ2V0QnVpbGRlcigpXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5ydW5SRVBMKGJ1aWxkZXIgJiYgYnVpbGRlci5uYW1lKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gZSBhcyBFcnJvclxuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLnRvU3RyaW5nKCksXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXG4gICAgICAgIFwiaWRlLWhhc2tlbGwtcmVwbDogQ291bGRuJ3QgZ2V0IGJ1aWxkZXIuIEZhbGxpbmcgYmFjayB0byBkZWZhdWx0IFJFUExcIixcbiAgICAgICAge1xuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgKVxuICAgICAgcmV0dXJuIHRoaXMucnVuUkVQTCgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJ1blJFUEwoXG4gICAgaW5idWlsZGVyPzogJ2NhYmFsLXYxJyB8ICdzdGFjaycgfCAnY2FiYWwtdjInIHwgJ25vbmUnLFxuICApIHtcbiAgICBsZXQgYnVpbGRlciA9IGluYnVpbGRlciB8fCBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKVxuICAgIGlmICghYnVpbGRlcikgdGhyb3cgbmV3IEVycm9yKGBEZWZhdWx0IFJFUEwgbm90IHNwZWNpZmllZGApXG5cbiAgICBjb25zdCB7IGN3ZCwgY29tcCwgY2FiYWwgfSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5jb21wb25lbnRGcm9tVVJJKFxuICAgICAgdGhpcy51cmksXG4gICAgKVxuICAgIHRoaXMuY3dkID0gY3dkXG5cbiAgICBsZXQgY29tbWFuZFBhdGg6IHN0cmluZ1xuICAgIGxldCBjb21tYW5kQXJnczogc3RyaW5nW11cbiAgICBsZXQgZXh0cmFBcmdzOiAoeDogc3RyaW5nKSA9PiBzdHJpbmdcbiAgICBzd2l0Y2ggKGJ1aWxkZXIpIHtcbiAgICAgIGNhc2UgJ2NhYmFsLXYxJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwnKS5sZWdhY3lDYWJhbFYxXG4gICAgICAgICAgPyBbJ3JlcGwnXVxuICAgICAgICAgIDogWyd2MS1yZXBsJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjLW9wdGlvbj0ke3h9YFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnY2FiYWwtdjInOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jYWJhbFBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFsndjItcmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ3N0YWNrJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuc3RhY2tQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbJ2doY2knXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGNpLW9wdGlvbnM9XCIke3h9XCJgXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdnaGNpJzpcbiAgICAgIGNhc2UgJ25vbmUnOlxuICAgICAgICBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gW11cbiAgICAgICAgZXh0cmFBcmdzID0gKHgpID0+IHhcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsZGVyICR7YnVpbGRlcn1gKVxuICAgIH1cblxuICAgIGNvbnN0IGV4dHJhQXJnc0xpc3QgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJykgfHwgW11cbiAgICBjb21tYW5kQXJncy5wdXNoKC4uLmV4dHJhQXJnc0xpc3QubWFwKGV4dHJhQXJncykpXG5cbiAgICBpZiAoY29tcCAmJiBjYWJhbCkge1xuICAgICAgaWYgKGJ1aWxkZXIgPT09ICdzdGFjaycpIHtcbiAgICAgICAgY29uc3QgY29tcGMgPSBjb21wLnN0YXJ0c1dpdGgoJ2xpYjonKSA/ICdsaWInIDogY29tcFxuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGAke2NhYmFsLm5hbWV9OiR7Y29tcGN9YClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbW1hbmRBcmdzLnB1c2goY29tcClcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmdoY2kgPSBuZXcgR0hDSSh7XG4gICAgICBhdG9tUGF0aDogcHJvY2Vzcy5leGVjUGF0aCxcbiAgICAgIGNvbW1hbmQ6IGNvbW1hbmRQYXRoLFxuICAgICAgYXJnczogY29tbWFuZEFyZ3MsXG4gICAgICBjd2Q6IHRoaXMuY3dkLmdldFBhdGgoKSxcbiAgICAgIG9uRXhpdDogYXN5bmMgKCkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGNvbnN0IGluaXRyZXMgPSBhd2FpdCB0aGlzLmdoY2kud2FpdFJlYWR5KClcbiAgICB0aGlzLnByb21wdCA9IGluaXRyZXMucHJvbXB0WzFdXG4gICAgYXdhaXQgdGhpcy5vbkluaXRpYWxMb2FkKClcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIoaW5pdHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHByb3RlY3RlZCBlcnJvcnNGcm9tU3RkZXJyKHN0ZGVycjogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmVycm9yc1xuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGxldCBuZXdNZXNzYWdlcyA9IGZhbHNlXG4gICAgbGV0IG5ld0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnIgb2Ygc3RkZXJyXG4gICAgICAuZmlsdGVyKCh4KSA9PiAhL15cXHMqXFxkKiBcXHwvLnRlc3QoeCkpXG4gICAgICAuam9pbignXFxuJylcbiAgICAgIC5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChlcnJvcilcbiAgICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdlcnJvcicpIGhhc0Vycm9ycyA9IHRydWVcblxuICAgICAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ3JlcGwnKSBuZXdNZXNzYWdlcyA9IHRydWVcbiAgICAgICAgICBlbHNlIG5ld0Vycm9ycyA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICB0aGlzLnNldEVycm9ycyhlcnJvcnMsIG5ld0Vycm9ycywgbmV3TWVzc2FnZXMpXG4gICAgcmV0dXJuIGhhc0Vycm9yc1xuICB9XG5cbiAgcHJvdGVjdGVkIHVuaW5kZW50TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQ6IG51bWJlciB8IHVuZGVmaW5lZFxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3QgbGluZUluZGVudCA9IG1hdGNoWzBdLmxlbmd0aFxuICAgICAgICBpZiAoIW1pbkluZGVudCB8fCBsaW5lSW5kZW50IDwgbWluSW5kZW50KSB7XG4gICAgICAgICAgbWluSW5kZW50ID0gbGluZUluZGVudFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChtaW5JbmRlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgbWkgPSBtaW5JbmRlbnRcbiAgICAgIGxpbmVzID0gbGluZXMubWFwKChsaW5lKSA9PiBsaW5lLnNsaWNlKG1pKSlcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGFyc2VNZXNzYWdlKHJhdzogc3RyaW5nKTogSUVycm9ySXRlbSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF0aGlzLmN3ZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBjb25zdCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9bIFxcdF0qKFxcW1teXFxdXStcXF0pP1sgXFx0XSpcXG4/KFteXSopL1xuICAgIGlmIChyYXcgJiYgcmF3LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIGNvbnN0IG1hdGNoZWQgPSByYXcubWF0Y2gobWF0Y2hMb2MpXG4gICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICBjb25zdCBbZmlsZWMsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0LCBtc2ddOiBBcnJheTxcbiAgICAgICAgICBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgICAgPiA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogVVBJLlRTZXZlcml0eSA9IHJhd1R5cCA/IHJhd1R5cC50b0xvd2VyQ2FzZSgpIDogJ2Vycm9yJ1xuICAgICAgICBsZXQgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgIGlmIChmaWxlYyA9PT0gJzxpbnRlcmFjdGl2ZT4nKSB7XG4gICAgICAgICAgZmlsZSA9IHVuZGVmaW5lZFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpbGUgPSBmaWxlY1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGVcbiAgICAgICAgICAgID8gaXNBYnNvbHV0ZShmaWxlKVxuICAgICAgICAgICAgICA/IG5vcm1hbGl6ZShmaWxlKVxuICAgICAgICAgICAgICA6IHRoaXMuY3dkLmdldEZpbGUoZmlsZSkuZ2V0UGF0aCgpXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwb3NpdGlvbjogW1xuICAgICAgICAgICAgcGFyc2VJbnQobGluZSBhcyBzdHJpbmcsIDEwKSAtIDEsXG4gICAgICAgICAgICBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UoXG4gICAgICAgICAgICAgIChtc2cgYXMgc3RyaW5nICYgeyB0cmltUmlnaHQoKTogc3RyaW5nIH0pLnRyaW1SaWdodCgpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNldEVycm9ycyhcbiAgICBlcnJvcnM6IElFcnJvckl0ZW1bXSxcbiAgICBuZXdFcnJvcnMgPSB0cnVlLFxuICAgIG5ld01lc3NhZ2VzID0gdHJ1ZSxcbiAgKSB7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnNcbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIGlmIChuZXdNZXNzYWdlcykge1xuICAgICAgICB0aGlzLnVwaS5zZXRNZXNzYWdlcyhcbiAgICAgICAgICB0aGlzLmVycm9ycy5maWx0ZXIoKHsgc2V2ZXJpdHkgfSkgPT4gc2V2ZXJpdHkgPT09ICdyZXBsJyksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChuZXdFcnJvcnMpIHtcbiAgICAgICAgdGhpcy51cGkuc2V0RXJyb3JzKFxuICAgICAgICAgIHRoaXMuZXJyb3JTcm91Y2UsXG4gICAgICAgICAgdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ICE9PSAncmVwbCcpLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH1cbiAgfVxufVxuIl19