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
                    const dupIdx = errors.findIndex((x) => isSameError(error, x));
                    if (dupIdx >= 0) {
                        if (errors[dupIdx]._time <= error._time) {
                            errors.splice(dupIdx, 1);
                        }
                        else {
                            continue;
                        }
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
            const now = Date.now();
            this.errors = this.errors.filter((x) => x.uri !== undefined || now - x._time < 3000);
            this.update();
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUEwQztBQUMxQywyQ0FBbUM7QUFFbkMsdURBQWtEO0FBQ2xELGlDQUE2QztBQUU3QyxrQ0FBaUM7QUFFakMsK0JBQTRDO0FBdUI1QyxLQUFLLFVBQVUsYUFBYSxDQUMxQixTQUF5QjtJQUV6QixNQUFNLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUM1QyxJQUFJLGFBQWEsS0FBSyxJQUFJO1FBQUUsT0FBTyxTQUFTLENBQUE7SUFDNUMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUE7SUFDdkQsSUFBSSxNQUFNLEtBQUssYUFBYSxFQUFFO1FBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUMzQixrREFBa0QsRUFDbEQ7WUFDRSxNQUFNLEVBQ0osc0VBQXNFO2dCQUN0RSxpRUFBaUU7Z0JBQ2pFLHFFQUFxRTtnQkFDckUsMkRBQTJEO1lBQzdELFdBQVcsRUFBRSxJQUFJO1NBQ2xCLENBQ0YsQ0FBQTtLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUE7QUFDZixDQUFDO0FBRUQsS0FBSyxVQUFVLFlBQVksQ0FDekIsT0FBNEI7SUFFNUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDbEIsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsRUFBRTtRQUNyQyxJQUFJLEtBQUssRUFBRTtZQUNULE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtTQUNkO2FBQU07WUFDTCxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7U0FDbEI7SUFDSCxDQUFDLENBQUMsQ0FD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RSxFQUFFO1FBQ3ZDLE9BQU8sRUFBRSxDQUFDLElBQUksS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFBO0tBQzNCO1NBQU0sSUFBSSxNQUFNLElBQUksRUFBRSxJQUFJLE1BQU0sSUFBSSxFQUFFLEVBQUU7UUFDdkMsT0FBTyxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsS0FBSyxFQUFFLENBQUMsV0FBVyxDQUFBO0tBQ2hFO1NBQU07UUFDTCxPQUFPLEtBQUssQ0FBQTtLQUNiO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAnZnV6emFsZHJpbidcblxuaW1wb3J0IHsgQ29tbWFuZEhpc3RvcnkgfSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7IEdIQ0ksIElSZXF1ZXN0UmVzdWx0IH0gZnJvbSAnLi9naGNpJ1xuaW1wb3J0ICogYXMgVVBJIGZyb20gJ2F0b20taGFza2VsbC11cGknXG5pbXBvcnQgKiBhcyBBdG9tVHlwZXMgZnJvbSAnYXRvbSdcbmltcG9ydCB7IFVQSUNvbnN1bWVyIH0gZnJvbSAnLi91cGlDb25zdW1lcidcbmltcG9ydCB7IGlzQWJzb2x1dGUsIG5vcm1hbGl6ZSB9IGZyb20gJ3BhdGgnXG5cbmV4cG9ydCB7IElSZXF1ZXN0UmVzdWx0IH1cblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1N0YXRlIHtcbiAgdXJpPzogc3RyaW5nXG4gIGhpc3Rvcnk/OiBzdHJpbmdbXVxuICBhdXRvUmVsb2FkUmVwZWF0PzogYm9vbGVhblxuICBjb250ZW50PzogSUNvbnRlbnRJdGVtW11cbiAgZm9jdXM/OiBib29sZWFuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxuICBobGNhY2hlPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSBleHRlbmRzIFVQSS5JUmVzdWx0SXRlbSB7XG4gIF90aW1lOiBudW1iZXJcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZENhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IGNhYmFsQ29udGVudHMgPSBhd2FpdCBjYWJhbEZpbGUucmVhZCgpXG4gIGlmIChjYWJhbENvbnRlbnRzID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkXG4gIGNvbnN0IG5vVGFicyA9IGNhYmFsQ29udGVudHMucmVwbGFjZSgvXFx0L2csICcgICAgICAgICcpXG4gIGlmIChub1RhYnMgIT09IGNhYmFsQ29udGVudHMpIHtcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICdUYWJzIGZvdW5kIGluIENhYmFsZmlsZSwgcmVwbGFjaW5nIHdpdGggOCBzcGFjZXMnLFxuICAgICAge1xuICAgICAgICBkZXRhaWw6XG4gICAgICAgICAgJ1RhYnMgYXJlIG5vdCBhbGxvd2VkIGFzIGluZGVudGF0aW9uIGNoYXJhY3RlcnMgaW4gQ2FiYWxmaWxlcyBkdWUgdG8gJyArXG4gICAgICAgICAgJ2EgbWlzc2luZyBzdGFuZGFyZCBpbnRlcnByZXRhdGlvbiBvZiB0YWIgd2lkdGguIFRhYnMgaGF2ZSBiZWVuICcgK1xuICAgICAgICAgICdhdXRvbWF0aWNhbGx5IHJlcGxhY2VkIGJ5IDggc3BhY2VzIGFzIHBlciBIYXNrZWxsIHJlcG9ydCBzdGFuZGFyZCwgJyArXG4gICAgICAgICAgJ2J1dCBpdCBpcyBhZHZpc2VkIHRvIGF2b2lkIHVzaW5nIHRhYnVsYXRpb24gaW4gQ2FiYWxmaWxlLicsXG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICApXG4gIH1cbiAgcmV0dXJuIG5vVGFic1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDYWJhbEZpbGUoXG4gIHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnksXG4pOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgY29uc3QgY29udCA9IGF3YWl0IG5ldyBQcm9taXNlPEFycmF5PEF0b21UeXBlcy5EaXJlY3RvcnkgfCBBdG9tVHlwZXMuRmlsZT4+KFxuICAgIChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gIClcbiAgcmV0dXJuIGNvbnQuZmlsdGVyKFxuICAgIChmaWxlKSA9PiBmaWxlLmlzRmlsZSgpICYmIGZpbGUuZ2V0QmFzZU5hbWUoKS5lbmRzV2l0aCgnLmNhYmFsJyksXG4gICkgYXMgQXRvbVR5cGVzLkZpbGVbXVxufVxuXG5hc3luYyBmdW5jdGlvbiBwYXJzZUNhYmFsRmlsZShcbiAgY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSxcbiAgY3dkOiBBdG9tVHlwZXMuRGlyZWN0b3J5LFxuICB1cmk6IHN0cmluZyB8IHVuZGVmaW5lZCxcbik6IFByb21pc2U8eyBjYWJhbD86IFV0aWwuSURvdENhYmFsOyBjb21wcz86IHN0cmluZ1tdIH0+IHtcbiAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IHJlYWRDYWJhbEZpbGUoY2FiYWxGaWxlKVxuICBpZiAoY2FiYWxDb250ZW50cyA9PT0gdW5kZWZpbmVkKSByZXR1cm4ge31cbiAgY29uc3QgY2FiYWwgPSBhd2FpdCBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgbGV0IGNvbXBzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZFxuICBpZiAodXJpICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb21wcyA9IGF3YWl0IFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGUoY2FiYWxDb250ZW50cywgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgfVxuICByZXR1cm4geyBjYWJhbDogY2FiYWwgPT09IG51bGwgPyB1bmRlZmluZWQgOiBjYWJhbCwgY29tcHMgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlYWR5UHJvbWlzZTogUHJvbWlzZTx2b2lkPlxuICBwcm90ZWN0ZWQgZ2hjaT86IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZD86IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nID0gJydcbiAgcHJvdGVjdGVkIHVwaT86IFVQSUNvbnN1bWVyXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdID0gW11cbiAgcHJvdGVjdGVkIF9hdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByb3RlY3RlZCBoaXN0b3J5OiBDb21tYW5kSGlzdG9yeVxuICBwcm90ZWN0ZWQgdXJpOiBzdHJpbmdcbiAgcHJpdmF0ZSBlbWl0dGVyID0gbmV3IEF0b21UeXBlcy5FbWl0dGVyPHsgZGVzdHJveWVkOiB2b2lkIH0+KClcblxuICBjb25zdHJ1Y3RvcihcbiAgICB1cGlQcm9taXNlOiBQcm9taXNlPFVQSUNvbnN1bWVyIHwgdW5kZWZpbmVkPixcbiAgICB7XG4gICAgICB1cmksXG4gICAgICBjb250ZW50LFxuICAgICAgaGlzdG9yeSxcbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH06IElWaWV3U3RhdGUsXG4gICAgcHJvdGVjdGVkIHJlYWRvbmx5IGVycm9yU3JvdWNlOiBzdHJpbmcsXG4gICkge1xuICAgIHRoaXMudXJpID0gdXJpIHx8ICcnXG4gICAgdGhpcy5oaXN0b3J5ID0gbmV3IENvbW1hbmRIaXN0b3J5KGhpc3RvcnkpXG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9ICEhYXV0b1JlbG9hZFJlcGVhdFxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHRoaXMucmVhZHlQcm9taXNlID0gdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFJvb3REaXIodXJpOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gVXRpbC5nZXRSb290RGlyKHVyaSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgY29tcG9uZW50RnJvbVVSSSh1cmk6IHN0cmluZykge1xuICAgIGNvbnN0IGN3ZCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRSb290RGlyKHVyaSlcbiAgICBjb25zdCBbY2FiYWxGaWxlXSA9IGF3YWl0IGdldENhYmFsRmlsZShjd2QpXG5cbiAgICBsZXQgY29tcDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgbGV0IGNhYmFsOiBVdGlsLklEb3RDYWJhbCB8IHVuZGVmaW5lZFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGNvbnN0IHBhcnNlZCA9IGF3YWl0IHBhcnNlQ2FiYWxGaWxlKGNhYmFsRmlsZSwgY3dkLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICAgICAgaWYgKHBhcnNlZC5jb21wcykgY29tcCA9IHBhcnNlZC5jb21wc1swXVxuICAgICAgaWYgKHBhcnNlZC5jYWJhbCkgY2FiYWwgPSBwYXJzZWQuY2FiYWxcbiAgICB9XG4gICAgcmV0dXJuIHsgY3dkLCBjb21wLCBjYWJhbCB9XG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgYXN5bmMgdXBkYXRlKHByb3BzPzogYW55KTogUHJvbWlzZTx2b2lkPlxuXG4gIHB1YmxpYyBvbkRpZERlc3Ryb3koY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcbiAgICByZXR1cm4gdGhpcy5lbWl0dGVyLm9uKCdkZXN0cm95ZWQnLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyB0b2dnbGVBdXRvUmVsb2FkUmVwZWF0KCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICF0aGlzLmF1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBydW5Db21tYW5kKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5naGNpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJylcbiAgICB9XG4gICAgY29uc3QgaW5wID0gY29tbWFuZC5zcGxpdCgnXFxuJylcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhpbnAsIChsaW5lSW5mbykgPT4ge1xuICAgICAgc3dpdGNoIChsaW5lSW5mby50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0ZGluJzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgICB0ZXh0OiBpbnAuam9pbignXFxuJyksXG4gICAgICAgICAgICAgIGhsOiB0cnVlLFxuICAgICAgICAgICAgICBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdzdGRvdXQnOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiZcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICAgIHRleHQ6IGxpbmVJbmZvLmxpbmUsXG4gICAgICAgICAgICAgIGhsOiB0cnVlLFxuICAgICAgICAgICAgICBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLW91dHB1dC10ZXh0JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IGxpbmVJbmZvLnByb21wdFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgdGhpcy51cGRhdGUoKVxuICAgIGlmIChjb21tYW5kLnRyaW0oKS5zdGFydHNXaXRoKCc6bCcpKSBhd2FpdCB0aGlzLm9uTG9hZCgpXG4gICAgZWxzZSBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOnInKSkgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgZWxzZSBpZiAoY29tbWFuZC50cmltKCkuc3RhcnRzV2l0aCgnOmUnKSkgYXdhaXQgdGhpcy5vblJlbG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCB7IHByb21wdCwgc3RkZXJyIH0gPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLnByb21wdCA9IHByb21wdFsxXVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgICBhd2FpdCB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gIXRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCgpIHtcbiAgICBpZiAoYXdhaXQgdGhpcy5naGNpUmVsb2FkKCkpIHtcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSB0aGlzLmhpc3RvcnkucGVlaygtMSlcbiAgICAgIGlmIChjb21tYW5kKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoY29tbWFuZClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG5cbiAgcHVibGljIHNldCBhdXRvUmVsb2FkUmVwZWF0KGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYXV0b1JlbG9hZFJlcGVhdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpXG4gICAgfVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMuZ2hjaS5pbnRlcnJ1cHQoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbXBsZXRpb25zKHByZWZpeDogc3RyaW5nKSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgaWYgKCF0aGlzLmdoY2kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKVxuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kuc2VuZENvbXBsZXRpb25SZXF1ZXN0KClcbiAgICBpZiAoIXJlcykgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHJlcy5zdGRvdXQuc2hpZnQoKVxuICAgIHJldHVybiBmaWx0ZXIocmVzLnN0ZG91dCwgcHJlZml4KS5tYXAoKHRleHQpID0+ICh7XG4gICAgICB0ZXh0OiB0ZXh0LnNsaWNlKDEsIC0xKSxcbiAgICB9KSlcbiAgfVxuXG4gIHB1YmxpYyBjbGVhckVycm9ycygpIHtcbiAgICB0aGlzLnNldEVycm9ycyhbXSlcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZWxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xlYXJFcnJvcnMoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2Rlc3Ryb3llZCcpXG4gICAgdGhpcy5jbGVhckVycm9ycygpXG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplKHVwaVByb21pc2U6IFByb21pc2U8VVBJQ29uc3VtZXIgfCB1bmRlZmluZWQ+KSB7XG4gICAgdGhpcy51cGkgPSBhd2FpdCB1cGlQcm9taXNlXG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIHRoaXMucnVuUkVQTCgpXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5nZXRCdWlsZGVyKClcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJ1blJFUEwoYnVpbGRlciAmJiBidWlsZGVyLm5hbWUpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc3QgZXJyb3IgPSBlIGFzIEVycm9yXG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcbiAgICAgICAgXCJpZGUtaGFza2VsbC1yZXBsOiBDb3VsZG4ndCBnZXQgYnVpbGRlci4gRmFsbGluZyBiYWNrIHRvIGRlZmF1bHQgUkVQTFwiLFxuICAgICAgICB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICApXG4gICAgICByZXR1cm4gdGhpcy5ydW5SRVBMKClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTChcbiAgICBpbmJ1aWxkZXI/OiAnY2FiYWwtdjEnIHwgJ3N0YWNrJyB8ICdjYWJhbC12MicgfCAnbm9uZScsXG4gICkge1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBpbmJ1aWxkZXIgfHwgYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJylcbiAgICBpZiAoIWJ1aWxkZXIpIHRocm93IG5ldyBFcnJvcihgRGVmYXVsdCBSRVBMIG5vdCBzcGVjaWZpZWRgKVxuXG4gICAgY29uc3QgeyBjd2QsIGNvbXAsIGNhYmFsIH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShcbiAgICAgIHRoaXMudXJpLFxuICAgIClcbiAgICB0aGlzLmN3ZCA9IGN3ZFxuXG4gICAgbGV0IGNvbW1hbmRQYXRoOiBzdHJpbmdcbiAgICBsZXQgY29tbWFuZEFyZ3M6IHN0cmluZ1tdXG4gICAgbGV0IGV4dHJhQXJnczogKHg6IHN0cmluZykgPT4gc3RyaW5nXG4gICAgc3dpdGNoIChidWlsZGVyKSB7XG4gICAgICBjYXNlICdjYWJhbC12MSc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsJykubGVnYWN5Q2FiYWxWMVxuICAgICAgICAgID8gWydyZXBsJ11cbiAgICAgICAgICA6IFsndjEtcmVwbCddXG4gICAgICAgIGV4dHJhQXJncyA9ICh4OiBzdHJpbmcpID0+IGAtLWdoYy1vcHRpb249JHt4fWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2NhYmFsLXYyJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJylcbiAgICAgICAgY29tbWFuZEFyZ3MgPSBbJ3YyLXJlcGwnXVxuICAgICAgICBleHRyYUFyZ3MgPSAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdzdGFjayc6XG4gICAgICAgIGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCcpXG4gICAgICAgIGNvbW1hbmRBcmdzID0gWydnaGNpJ11cbiAgICAgICAgZXh0cmFBcmdzID0gKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZ2hjaSc6XG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVBhdGgnKVxuICAgICAgICBjb21tYW5kQXJncyA9IFtdXG4gICAgICAgIGV4dHJhQXJncyA9ICh4KSA9PiB4XG4gICAgICAgIGJyZWFrXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYnVpbGRlciAke2J1aWxkZXJ9YClcbiAgICB9XG5cbiAgICBjb25zdCBleHRyYUFyZ3NMaXN0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpIHx8IFtdXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi5leHRyYUFyZ3NMaXN0Lm1hcChleHRyYUFyZ3MpKVxuXG4gICAgaWYgKGNvbXAgJiYgY2FiYWwpIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGNvbnN0IGNvbXBjID0gY29tcC5zdGFydHNXaXRoKCdsaWI6JykgPyAnbGliJyA6IGNvbXBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChgJHtjYWJhbC5uYW1lfToke2NvbXBjfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGNvbXApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jICgpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKGluaXRyZXMuc3RkZXJyLCB0cnVlKVxuICAgIHJldHVybiB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVycihcbiAgICBzdGRlcnI6IHN0cmluZ1tdLFxuICAgIGZpbHRlckluaXRXYXJuaW5ncyA9IGZhbHNlLFxuICApOiBib29sZWFuIHtcbiAgICBjb25zdCBlcnJvcnMgPSB0aGlzLmVycm9yc1xuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGxldCBuZXdNZXNzYWdlcyA9IGZhbHNlXG4gICAgbGV0IG5ld0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnIgb2Ygc3RkZXJyXG4gICAgICAuZmlsdGVyKCh4KSA9PiAhL15cXHMqXFxkKiBcXHwvLnRlc3QoeCkpXG4gICAgICAuam9pbignXFxuJylcbiAgICAgIC5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBmaWx0ZXJJbml0V2FybmluZ3MgJiZcbiAgICAgICAgICAgIGVycm9yLnNldmVyaXR5ID09PSAncmVwbCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBlcnJvci5tZXNzYWdlID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgZXJyb3IubWVzc2FnZS5tYXRjaChcbiAgICAgICAgICAgICAgL15Tb21lIGZsYWdzIGhhdmUgbm90IGJlZW4gcmVjb2duaXplZDogKD86KD86cHJvbXB0Mnxwcm9tcHQtY29udCksXFxzKikrXFxzKi8sXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGR1cElkeCA9IGVycm9ycy5maW5kSW5kZXgoKHgpID0+IGlzU2FtZUVycm9yKGVycm9yLCB4KSlcbiAgICAgICAgICBpZiAoZHVwSWR4ID49IDApIHtcbiAgICAgICAgICAgIGlmIChlcnJvcnNbZHVwSWR4XS5fdGltZSA8PSBlcnJvci5fdGltZSkge1xuICAgICAgICAgICAgICBlcnJvcnMuc3BsaWNlKGR1cElkeCwgMSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSBoYXNFcnJvcnMgPSB0cnVlXG5cbiAgICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdyZXBsJykgbmV3TWVzc2FnZXMgPSB0cnVlXG4gICAgICAgICAgZWxzZSBuZXdFcnJvcnMgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zZXRFcnJvcnMoZXJyb3JzLCBuZXdFcnJvcnMsIG5ld01lc3NhZ2VzKVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50OiBudW1iZXIgfCB1bmRlZmluZWRcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgaWYgKCFtaW5JbmRlbnQgfHwgbGluZUluZGVudCA8IG1pbkluZGVudCkge1xuICAgICAgICAgIG1pbkluZGVudCA9IGxpbmVJbmRlbnRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobWluSW5kZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1pID0gbWluSW5kZW50XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaSkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZShyYXc6IHN0cmluZyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5jd2QpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/WyBcXHRdKihcXFtbXlxcXV0rXFxdKT9bIFxcdF0qXFxuPyhbXl0qKS9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgW2ZpbGVjLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dCwgbXNnXTogQXJyYXk8XG4gICAgICAgICAgc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgID4gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFVQSS5UU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlXG4gICAgICAgICAgICA/IGlzQWJzb2x1dGUoZmlsZSlcbiAgICAgICAgICAgICAgPyBub3JtYWxpemUoZmlsZSlcbiAgICAgICAgICAgICAgOiB0aGlzLmN3ZC5nZXRGaWxlKGZpbGUpLmdldFBhdGgoKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcG9zaXRpb246IFtcbiAgICAgICAgICAgIHBhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLFxuICAgICAgICAgICAgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMudW5pbmRlbnRNZXNzYWdlKFxuICAgICAgICAgICAgICAobXNnIGFzIHN0cmluZyAmIHsgdHJpbVJpZ2h0KCk6IHN0cmluZyB9KS50cmltUmlnaHQoKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBoaWdobGlnaHRlcjogJ2hpbnQubWVzc2FnZS5oYXNrZWxsJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRFcnJvcnMoXG4gICAgZXJyb3JzOiBJRXJyb3JJdGVtW10sXG4gICAgbmV3RXJyb3JzID0gdHJ1ZSxcbiAgICBuZXdNZXNzYWdlcyA9IHRydWUsXG4gICkge1xuICAgIHRoaXMuZXJyb3JzID0gZXJyb3JzXG4gICAgaWYgKHRoaXMudXBpKSB7XG4gICAgICBpZiAobmV3TWVzc2FnZXMpIHtcbiAgICAgICAgdGhpcy51cGkuc2V0TWVzc2FnZXMoXG4gICAgICAgICAgdGhpcy5lcnJvcnMuZmlsdGVyKCh7IHNldmVyaXR5IH0pID0+IHNldmVyaXR5ID09PSAncmVwbCcpLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBpZiAobmV3RXJyb3JzKSB7XG4gICAgICAgIHRoaXMudXBpLnNldEVycm9ycyhcbiAgICAgICAgICB0aGlzLmVycm9yU3JvdWNlLFxuICAgICAgICAgIHRoaXMuZXJyb3JzLmZpbHRlcigoeyBzZXZlcml0eSB9KSA9PiBzZXZlcml0eSAhPT0gJ3JlcGwnKSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpXG4gICAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcihcbiAgICAgICAgKHgpID0+IHgudXJpICE9PSB1bmRlZmluZWQgfHwgbm93IC0geC5fdGltZSA8IDMwMDAsXG4gICAgICApXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNTYW1lRXJyb3IoZTE6IElFcnJvckl0ZW0sIGUyOiBJRXJyb3JJdGVtKSB7XG4gIGNvbnN0IHNhbWVDb250ZXh0ID0gZTEuY29udGV4dCA9PT0gZTIuY29udGV4dFxuICBjb25zdCBzYW1lUG9zID1cbiAgICBlMS5wb3NpdGlvbiAmJlxuICAgIGUyLnBvc2l0aW9uICYmXG4gICAgQXRvbVR5cGVzLlBvaW50LmZyb21PYmplY3QoZTEucG9zaXRpb24pLmlzRXF1YWwoZTIucG9zaXRpb24pXG4gIGNvbnN0IHNhbWVTZXZlcml0eSA9IGUxLnNldmVyaXR5ID09PSBlMi5zZXZlcml0eVxuICBjb25zdCBzYW1lVXJpID0gZTEudXJpID09PSBlMi51cmlcbiAgY29uc3Qgc2FtZU1lc3NhZ2UgPSBpc1NhbWVNZXNzYWdlKGUxLm1lc3NhZ2UsIGUyLm1lc3NhZ2UpXG4gIHJldHVybiBzYW1lQ29udGV4dCAmJiBzYW1lUG9zICYmIHNhbWVTZXZlcml0eSAmJiBzYW1lVXJpICYmIHNhbWVNZXNzYWdlXG59XG5cbmZ1bmN0aW9uIGlzU2FtZU1lc3NhZ2UobTE6IFVQSS5UTWVzc2FnZSwgbTI6IFVQSS5UTWVzc2FnZSkge1xuICBpZiAodHlwZW9mIG0xID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbTIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIG0xID09PSBtMlxuICB9IGVsc2UgaWYgKCdodG1sJyBpbiBtMSAmJiAnaHRtbCcgaW4gbTIpIHtcbiAgICByZXR1cm4gbTEuaHRtbCA9PT0gbTIuaHRtbFxuICB9IGVsc2UgaWYgKCd0ZXh0JyBpbiBtMSAmJiAndGV4dCcgaW4gbTIpIHtcbiAgICByZXR1cm4gbTEudGV4dCA9PT0gbTIudGV4dCAmJiBtMS5oaWdobGlnaHRlciA9PT0gbTIuaGlnaGxpZ2h0ZXJcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuIl19