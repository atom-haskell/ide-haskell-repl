"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
class IdeHaskellReplBase {
    static getRootDir(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            return Util.getRootDir(uri);
        });
    }
    static getCabalFile(rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const cont = yield new Promise((resolve, reject) => rootDir.getEntries((error, contents) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(contents);
                }
            }));
            return cont.filter((file) => file.isFile() && file.getBaseName().endsWith('.cabal'));
        });
    }
    static parseCabalFile(cabalFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const cabalContents = yield cabalFile.read();
            return Util.parseDotCabal(cabalContents);
        });
    }
    static getComponent(cabalFile, uri) {
        return __awaiter(this, void 0, void 0, function* () {
            const cabalContents = yield cabalFile.read();
            const cwd = cabalFile.getParent();
            return Util.getComponentFromFile(cabalContents, cwd.relativize(uri));
        });
    }
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }) {
        this.uri = uri || '';
        this.history = new command_history_1.CommandHistory(history);
        this._autoReloadRepeat = autoReloadRepeat;
        this.errors = [];
        this.prompt = '';
        this.messages = content || [];
        this.initialize(upiPromise);
    }
    toggleAutoReloadRepeat() {
        this.autoReloadRepeat = !this.autoReloadRepeat;
    }
    runCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            const inp = command.split('\n');
            const res = yield this.ghci.writeLines(inp, (lineInfo) => {
                switch (lineInfo.type) {
                    case 'stdin':
                        lineInfo.line && this.messages.push({
                            text: inp.join('\n'), hl: true, cls: 'ide-haskell-repl-input-text',
                        });
                        break;
                    case 'stdout':
                        lineInfo.line && this.messages.push({
                            text: lineInfo.line, hl: true, cls: 'ide-haskell-repl-output-text',
                        });
                        break;
                    case 'prompt':
                        this.prompt = lineInfo.prompt[1];
                        break;
                    default: break;
                }
                this.update();
            });
            this.errorsFromStderr(res.stderr);
            return res;
        });
    }
    ghciReload() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            const res = yield this.ghci.reload();
            this.onReload();
            return res;
        });
    }
    ghciReloadRepeat() {
        return __awaiter(this, void 0, void 0, function* () {
            const { stderr } = yield this.ghciReload();
            if (!this.errorsFromStderr(stderr)) {
                const command = this.history.goBack('');
                return this.runCommand(command);
            }
        });
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
    getCompletions(prefix) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!prefix.trim()) {
                return [];
            }
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            const { stdout } = yield this.ghci.sendCompletionRequest();
            stdout.shift();
            return fuzzaldrin_1.filter(stdout, prefix).map((text) => ({ text: text.slice(1, -1) }));
        });
    }
    onInitialLoad() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.onLoad();
        });
    }
    onReload() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.onLoad();
        });
    }
    onLoad() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ghci) {
                this.ghci.destroy();
            }
        });
    }
    initialize(upiPromise) {
        return __awaiter(this, void 0, void 0, function* () {
            this.upi = yield upiPromise;
            if (!this.upi) {
                return this.runREPL(null);
            }
            try {
                const builder = yield this.upi.getOthersConfigParam('ide-haskell-cabal', 'builder');
                this.runREPL((builder || {}).name);
            }
            catch (error) {
                if (error) {
                    atom.notifications.addFatalError(error.toString(), {
                        detail: error,
                        dismissable: true,
                    });
                    this.destroy();
                }
                else {
                    atom.notifications.addWarning("Can't run REPL without knowing what builder to use");
                    this.destroy();
                }
            }
        });
    }
    runREPL(inbuilder) {
        return __awaiter(this, void 0, void 0, function* () {
            let builder = inbuilder || atom.config.get('ide-haskell-repl.defaultRepl');
            const subst = {
                'nix-build': 'cabal',
                'none': 'ghci',
            };
            builder = (subst[builder] || builder);
            this.cwd = yield IdeHaskellReplBase.getRootDir(this.uri);
            const [cabalFile] = yield IdeHaskellReplBase.getCabalFile(this.cwd);
            let comp, cabal;
            if (cabalFile) {
                cabal = yield IdeHaskellReplBase.parseCabalFile(cabalFile);
                [comp] = yield IdeHaskellReplBase.getComponent(cabalFile, this.cwd.relativize(this.uri));
            }
            const commandPath = atom.config.get(`ide-haskell-repl.${builder}Path`);
            const args = {
                stack: ['ghci'],
                cabal: ['repl'],
                ghci: [],
            };
            const extraArgs = {
                stack: (x) => `--ghci-options="${x}"`,
                cabal: (x) => `--ghc-option=${x}`,
                ghci: (x) => x,
            };
            if (!args[builder]) {
                throw new Error(`Unknown builder ${builder}`);
            }
            const commandArgs = args[builder];
            commandArgs.push(...(atom.config.get('ide-haskell-repl.extraArgs').map(extraArgs[builder])));
            if (comp && cabal) {
                if (builder === 'stack') {
                    if (comp.startsWith('lib:')) {
                        comp = 'lib';
                    }
                    comp = `${cabal.name}:${comp}`;
                    commandArgs.push('--main-is', comp);
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
                onExit: (code) => __awaiter(this, void 0, void 0, function* () { return this.destroy(); }),
            });
            const initres = yield this.ghci.waitReady();
            this.prompt = initres.prompt[1];
            this.errorsFromStderr(initres.stderr);
            yield this.onInitialLoad();
            this.update();
        });
    }
    errorsFromStderr(stderr) {
        this.errors = this.errors.filter(({ _time }) => Date.now() - _time < 10000);
        let hasErrors = false;
        for (const err of stderr.join('\n').split(/\n(?=\S)/)) {
            if (err) {
                const error = this.parseMessage(err);
                if (error) {
                    this.errors.push(error);
                    if (error.severity === 'error') {
                        hasErrors = true;
                    }
                }
            }
        }
        if (this.upi) {
            this.upi.setMessages(this.errors);
        }
        else {
            this.update();
        }
        return hasErrors;
    }
    unindentMessage(message) {
        let lines = message.split('\n').filter((x) => !x.match(/^\s*$/));
        let minIndent = null;
        for (const line of lines) {
            const match = line.match(/^\s*/);
            const lineIndent = match[0].length;
            if (!minIndent || lineIndent < minIndent) {
                minIndent = lineIndent;
            }
        }
        if (minIndent) {
            lines = lines.map((line) => line.slice(minIndent));
        }
        return lines.join('\n');
    }
    parseMessage(raw) {
        if (!this.cwd) {
            return;
        }
        const matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?\s*(\[[^\]]+\])?/;
        if (raw && raw.trim() !== '') {
            const matched = raw.match(matchLoc);
            if (matched) {
                const msg = raw.split('\n').slice(1).join('\n');
                const [filec, line, col, rawTyp, context] = matched.slice(1);
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
                    uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : undefined,
                    position: [parseInt(line, 10) - 1, parseInt(col, 10) - 1],
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
    }
}
exports.IdeHaskellReplBase = IdeHaskellReplBase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBMkIzQjtJQUNTLE1BQU0sQ0FBTyxVQUFVLENBQUUsR0FBVzs7WUFDekMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDN0IsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFPLFlBQVksQ0FBRSxPQUE0Qjs7WUFDNUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtnQkFDdEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2YsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7Z0JBQ25CLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFBO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFxQixDQUFBO1FBQ2pGLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxjQUFjLENBQUUsU0FBeUI7O1lBQzNELE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQzFDLENB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LENBQUM7d0JBQ3BELFdBQVcsRUFBRSxzQkFBc0I7cUJBQ3BDO29CQUNELE9BQU87b0JBQ1AsUUFBUSxFQUFFLEdBQUc7b0JBQ2IsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7aUJBQ2xCLENBQUE7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDO29CQUNMLE9BQU8sRUFBRSxHQUFHO29CQUNaLFFBQVEsRUFBRSxNQUFNO29CQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBeFNELGdEQXdTQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UmFuZ2V9IGZyb20gJ2F0b20nXG5pbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQge0NvbW1hbmRIaXN0b3J5fSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7R0hDSX0gZnJvbSAnLi9naGNpJ1xuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbiAgaGxjYWNoZT86IHN0cmluZ1xufVxuXG50eXBlIFNldmVyaXR5ID0gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdyZXBsJyB8IHN0cmluZ1xuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0ge1xuICB1cmk/OiBzdHJpbmcsXG4gIHBvc2l0aW9uPzogW251bWJlciwgbnVtYmVyXSxcbiAgbWVzc2FnZTogc3RyaW5nIHwgeyB0ZXh0OiBzdHJpbmcsIGhpZ2hsaWdodGVyOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyICh1cmk6IHN0cmluZykge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDYWJhbEZpbGUgKHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnkpOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHJldHVybiBjb250LmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlQ2FiYWxGaWxlIChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlKTogUHJvbWlzZTxVdGlsLklEb3RDYWJhbCB8IG51bGw+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIHJldHVybiBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q29tcG9uZW50IChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLCB1cmk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIGNvbnN0IGN3ZCA9IGNhYmFsRmlsZS5nZXRQYXJlbnQoKVxuICAgIHJldHVybiBVdGlsLmdldENvbXBvbmVudEZyb21GaWxlKGNhYmFsQ29udGVudHMsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gIH1cblxuICBwcm90ZWN0ZWQgZ2hjaT86IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZD86IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk/OiBVUEkuSVVQSUluc3RhbmNlXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdXG4gIHByb3RlY3RlZCBfYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhblxuICBwcm90ZWN0ZWQgaGlzdG9yeTogQ29tbWFuZEhpc3RvcnlcbiAgcHJvdGVjdGVkIHVyaTogc3RyaW5nXG5cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2U6IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4sIHtcbiAgICB1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICB9OiBJVmlld1N0YXRlKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMuZXJyb3JzID0gW11cbiAgICB0aGlzLnByb21wdCA9ICcnXG5cbiAgICB0aGlzLm1lc3NhZ2VzID0gY29udGVudCB8fCBbXVxuXG4gICAgdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgdXBkYXRlICgpOiBhbnlcblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgdGhpcy5hdXRvUmVsb2FkUmVwZWF0ID0gISB0aGlzLmF1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBydW5Db21tYW5kIChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAobGluZUluZm8pID0+IHtcbiAgICAgIHN3aXRjaCAobGluZUluZm8udHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogbGluZUluZm8ubGluZSwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IGxpbmVJbmZvLnByb21wdFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6IGJyZWFrXG4gICAgICB9XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZCAoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCAoKSB7XG4gICAgY29uc3Qge3N0ZGVycn0gPSBhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKVxuICAgIGlmICghIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LmdvQmFjaygnJylcbiAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoY29tbWFuZClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc2V0IGF1dG9SZWxvYWRSZXBlYXQgKGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMgKHByZWZpeDogc3RyaW5nKSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIHN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihzdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe3RleHQ6IHRleHQuc2xpY2UoMSwgLTEpfSkpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblJlbG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGluaXRpYWxpemUgKHVwaVByb21pc2U6IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7IHJldHVybiB0aGlzLnJ1blJFUEwobnVsbCkgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5nZXRPdGhlcnNDb25maWdQYXJhbSgnaWRlLWhhc2tlbGwtY2FiYWwnLCAnYnVpbGRlcicpIGFzIHtuYW1lOiBzdHJpbmd9XG4gICAgICB0aGlzLnJ1blJFUEwoKGJ1aWxkZXIgfHwge30pLm5hbWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvcixcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFwiQ2FuJ3QgcnVuIFJFUEwgd2l0aG91dCBrbm93aW5nIHdoYXQgYnVpbGRlciB0byB1c2VcIilcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTCAoaW5idWlsZGVyOiBzdHJpbmcgfCBudWxsKSB7XG4gICAgbGV0IGJ1aWxkZXIgPSBpbmJ1aWxkZXIgfHwgYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJylcbiAgICBjb25zdCBzdWJzdCA9IHtcbiAgICAgICduaXgtYnVpbGQnOiAnY2FiYWwnLFxuICAgICAgJ25vbmUnOiAnZ2hjaScsXG4gICAgfVxuICAgIGJ1aWxkZXIgPSAoc3Vic3RbYnVpbGRlcl0gfHwgYnVpbGRlcilcblxuICAgIHRoaXMuY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodGhpcy51cmkpXG4gICAgY29uc3QgW2NhYmFsRmlsZV0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Q2FiYWxGaWxlKHRoaXMuY3dkKVxuXG4gICAgbGV0IGNvbXAsIGNhYmFsXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgY2FiYWwgPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UucGFyc2VDYWJhbEZpbGUoY2FiYWxGaWxlKTtcbiAgICAgIFtjb21wXSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRDb21wb25lbnQoY2FiYWxGaWxlLCB0aGlzLmN3ZC5yZWxhdGl2aXplKHRoaXMudXJpKSlcbiAgICB9XG4gICAgY29uc3QgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoYGlkZS1oYXNrZWxsLXJlcGwuJHtidWlsZGVyfVBhdGhgKVxuXG4gICAgY29uc3QgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBjb25zdCBleHRyYUFyZ3MgPSB7XG4gICAgICBzdGFjazogKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYCxcbiAgICAgIGNhYmFsOiAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gLFxuICAgICAgZ2hjaTogKHg6IHN0cmluZykgPT4geCxcbiAgICB9XG5cbiAgICBpZiAoIWFyZ3NbYnVpbGRlcl0pIHsgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJ1aWxkZXIgJHtidWlsZGVyfWApIH1cbiAgICBjb25zdCBjb21tYW5kQXJncyA9IGFyZ3NbYnVpbGRlcl1cblxuICAgIGNvbW1hbmRBcmdzLnB1c2goLi4uKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5leHRyYUFyZ3MnKS5tYXAoZXh0cmFBcmdzW2J1aWxkZXJdKSkpXG5cbiAgICBpZiAoY29tcCAmJiBjYWJhbCkge1xuICAgICAgaWYgKGJ1aWxkZXIgPT09ICdzdGFjaycpIHtcbiAgICAgICAgaWYgKGNvbXAuc3RhcnRzV2l0aCgnbGliOicpKSB7XG4gICAgICAgICAgY29tcCA9ICdsaWInXG4gICAgICAgIH1cbiAgICAgICAgY29tcCA9IGAke2NhYmFsLm5hbWV9OiR7Y29tcH1gXG4gICAgICAgIGNvbW1hbmRBcmdzLnB1c2goJy0tbWFpbi1pcycsIGNvbXApXG4gICAgICB9IGVsc2UgeyBjb21tYW5kQXJncy5wdXNoKGNvbXApIH1cbiAgICB9XG5cbiAgICB0aGlzLmdoY2kgPSBuZXcgR0hDSSh7XG4gICAgICBhdG9tUGF0aDogcHJvY2Vzcy5leGVjUGF0aCxcbiAgICAgIGNvbW1hbmQ6IGNvbW1hbmRQYXRoLFxuICAgICAgYXJnczogY29tbWFuZEFyZ3MsXG4gICAgICBjd2Q6IHRoaXMuY3dkLmdldFBhdGgoKSxcbiAgICAgIG9uRXhpdDogYXN5bmMgKGNvZGUpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVyciAoaW5pdHJlcy5zdGRlcnIpXG4gICAgYXdhaXQgdGhpcy5vbkluaXRpYWxMb2FkKClcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVyciAoc3RkZXJyOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuZmlsdGVyKCh7X3RpbWV9KSA9PiBEYXRlLm5vdygpIC0gX3RpbWUgPCAxMDAwMClcbiAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2VcbiAgICBmb3IgKGNvbnN0IGVyciBvZiBzdGRlcnIuam9pbignXFxuJykuc3BsaXQoL1xcbig/PVxcUykvKSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjb25zdCBlcnJvciA9IHRoaXMucGFyc2VNZXNzYWdlKGVycilcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgdGhpcy5lcnJvcnMucHVzaChlcnJvcilcbiAgICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMudXBpKSB7XG4gICAgICB0aGlzLnVwaS5zZXRNZXNzYWdlcyh0aGlzLmVycm9ycylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH1cbiAgICByZXR1cm4gaGFzRXJyb3JzXG4gIH1cblxuICBwcm90ZWN0ZWQgdW5pbmRlbnRNZXNzYWdlIChtZXNzYWdlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQ6IG51bWJlciB8IG51bGwgPSBudWxsXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqLykhXG4gICAgICBjb25zdCBsaW5lSW5kZW50ID0gbWF0Y2hbMF0ubGVuZ3RoXG4gICAgICBpZiAoIW1pbkluZGVudCB8fCBsaW5lSW5kZW50IDwgbWluSW5kZW50KSB7IG1pbkluZGVudCA9IGxpbmVJbmRlbnQgfVxuICAgIH1cbiAgICBpZiAobWluSW5kZW50KSB7XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaW5JbmRlbnQhKSlcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGFyc2VNZXNzYWdlIChyYXc6IHN0cmluZyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQge1xuICAgIGlmICghdGhpcy5jd2QpIHsgcmV0dXJuIH1cbiAgICBjb25zdCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9cXHMqKFxcW1teXFxdXStcXF0pPy9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgbXNnID0gcmF3LnNwbGl0KCdcXG4nKS5zbGljZSgxKS5qb2luKCdcXG4nKVxuICAgICAgICBjb25zdCBbZmlsZWMsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0XTogQXJyYXk8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlID8gdGhpcy5jd2QuZ2V0RmlsZSh0aGlzLmN3ZC5yZWxhdGl2aXplKGZpbGUpKS5nZXRQYXRoKCkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UoKG1zZyBhcyBhbnkpLnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=