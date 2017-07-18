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
    static componentFromURI(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            const cwd = yield IdeHaskellReplBase.getRootDir(uri);
            const [cabalFile] = yield IdeHaskellReplBase.getCabalFile(cwd);
            let comp, cabal;
            if (cabalFile) {
                cabal = yield IdeHaskellReplBase.parseCabalFile(cabalFile);
                [comp] = yield IdeHaskellReplBase.getComponent(cabalFile, cwd.relativize(uri));
            }
            return { cwd, comp, cabal };
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
                const command = this.history.peek(-1);
                if (command) {
                    return this.runCommand(command);
                }
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
            const { cwd, comp, cabal } = yield IdeHaskellReplBase.componentFromURI(this.uri);
            this.cwd = cwd;
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
                    const compc = comp.startsWith('lib:')
                        ? 'lib'
                        : comp;
                    commandArgs.push('--main-is', `${cabal.name}:${compc}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBa0IzQjtJQUNTLE1BQU0sQ0FBTyxVQUFVLENBQUUsR0FBVzs7WUFDekMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDN0IsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFPLFlBQVksQ0FBRSxPQUE0Qjs7WUFDNUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtnQkFDdEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2YsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7Z0JBQ25CLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFBO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFxQixDQUFBO1FBQ2pGLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxjQUFjLENBQUUsU0FBeUI7O1lBQzNELE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQzFDLENB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QyxHQUFhLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM3RSxPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUUsR0FBdUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDaEYsV0FBVyxFQUFFLHNCQUFzQjtxQkFDcEM7b0JBQ0QsT0FBTztvQkFDUCxRQUFRLEVBQUUsR0FBRztvQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUM7b0JBQ0wsT0FBTyxFQUFFLEdBQUc7b0JBQ1osUUFBUSxFQUFFLE1BQU07b0JBQ2hCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFsVEQsZ0RBa1RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSYW5nZX0gZnJvbSAnYXRvbSdcbmltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7Q29tbWFuZEhpc3Rvcnl9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHtHSENJfSBmcm9tICcuL2doY2knXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdTdGF0ZSB7XG4gIHVyaT86IHN0cmluZ1xuICBoaXN0b3J5Pzogc3RyaW5nW11cbiAgYXV0b1JlbG9hZFJlcGVhdD86IGJvb2xlYW5cbiAgY29udGVudD86IElDb250ZW50SXRlbVtdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxuICBobGNhY2hlPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSBleHRlbmRzIFVQSS5JUmVzdWx0SXRlbSB7IF90aW1lOiBudW1iZXIgfVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyICh1cmk6IHN0cmluZykge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDYWJhbEZpbGUgKHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnkpOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHJldHVybiBjb250LmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlQ2FiYWxGaWxlIChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlKTogUHJvbWlzZTxVdGlsLklEb3RDYWJhbCB8IG51bGw+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIHJldHVybiBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q29tcG9uZW50IChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLCB1cmk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIGNvbnN0IGN3ZCA9IGNhYmFsRmlsZS5nZXRQYXJlbnQoKVxuICAgIHJldHVybiBVdGlsLmdldENvbXBvbmVudEZyb21GaWxlKGNhYmFsQ29udGVudHMsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGNvbXBvbmVudEZyb21VUkkgKHVyaTogc3RyaW5nKSB7XG4gICAgY29uc3QgY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodXJpKVxuICAgIGNvbnN0IFtjYWJhbEZpbGVdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENhYmFsRmlsZShjd2QpXG5cbiAgICBsZXQgY29tcCwgY2FiYWxcbiAgICBpZiAoY2FiYWxGaWxlKSB7XG4gICAgICBjYWJhbCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5wYXJzZUNhYmFsRmlsZShjYWJhbEZpbGUpO1xuICAgICAgW2NvbXBdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENvbXBvbmVudChjYWJhbEZpbGUsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gICAgfVxuICAgIHJldHVybiB7Y3dkLCBjb21wLCBjYWJhbH1cbiAgfVxuXG4gIHByb3RlY3RlZCBnaGNpPzogR0hDSVxuICBwcm90ZWN0ZWQgY3dkPzogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcm90ZWN0ZWQgcHJvbXB0OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHVwaT86IFVQSS5JVVBJSW5zdGFuY2VcbiAgcHJvdGVjdGVkIG1lc3NhZ2VzOiBJQ29udGVudEl0ZW1bXVxuICBwcm90ZWN0ZWQgZXJyb3JzOiBJRXJyb3JJdGVtW11cbiAgcHJvdGVjdGVkIF9hdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByb3RlY3RlZCBoaXN0b3J5OiBDb21tYW5kSGlzdG9yeVxuICBwcm90ZWN0ZWQgdXJpOiBzdHJpbmdcblxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwge1xuICAgIHVyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gIH06IElWaWV3U3RhdGUpIHtcbiAgICB0aGlzLnVyaSA9IHVyaSB8fCAnJ1xuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy5lcnJvcnMgPSBbXVxuICAgIHRoaXMucHJvbXB0ID0gJydcblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBhYnN0cmFjdCBhc3luYyB1cGRhdGUgKCk6IFByb21pc2U8dm9pZD5cblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgdGhpcy5hdXRvUmVsb2FkUmVwZWF0ID0gISB0aGlzLmF1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBydW5Db21tYW5kIChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAobGluZUluZm8pID0+IHtcbiAgICAgIHN3aXRjaCAobGluZUluZm8udHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgbGluZUluZm8ubGluZSAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogbGluZUluZm8ubGluZSwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IGxpbmVJbmZvLnByb21wdFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6IGJyZWFrXG4gICAgICB9XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZCAoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCAoKSB7XG4gICAgY29uc3Qge3N0ZGVycn0gPSBhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKVxuICAgIGlmICghIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LnBlZWsoLTEpXG4gICAgICBpZiAoY29tbWFuZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHNldCBhdXRvUmVsb2FkUmVwZWF0IChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIHRoaXMuZ2hjaS5pbnRlcnJ1cHQoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbXBsZXRpb25zIChwcmVmaXg6IHN0cmluZykge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCB0aGlzLmdoY2kuc2VuZENvbXBsZXRpb25SZXF1ZXN0KClcbiAgICBzdGRvdXQuc2hpZnQoKVxuICAgIHJldHVybiBmaWx0ZXIoc3Rkb3V0LCBwcmVmaXgpLm1hcCgodGV4dCkgPT4gKHt0ZXh0OiB0ZXh0LnNsaWNlKDEsIC0xKX0pKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZWxvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkICgpIHtcbiAgICAvLyBub29wXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplICh1cGlQcm9taXNlOiBQcm9taXNlPFVQSS5JVVBJSW5zdGFuY2U+KSB7XG4gICAgdGhpcy51cGkgPSBhd2FpdCB1cGlQcm9taXNlXG4gICAgaWYgKCF0aGlzLnVwaSkgeyByZXR1cm4gdGhpcy5ydW5SRVBMKG51bGwpIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkuZ2V0T3RoZXJzQ29uZmlnUGFyYW0oJ2lkZS1oYXNrZWxsLWNhYmFsJywgJ2J1aWxkZXInKSBhcyB7bmFtZTogc3RyaW5nfVxuICAgICAgdGhpcy5ydW5SRVBMKChidWlsZGVyIHx8IHt9KS5uYW1lKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcIkNhbid0IHJ1biBSRVBMIHdpdGhvdXQga25vd2luZyB3aGF0IGJ1aWxkZXIgdG8gdXNlXCIpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJ1blJFUEwgKGluYnVpbGRlcjogc3RyaW5nIHwgbnVsbCkge1xuICAgIGxldCBidWlsZGVyID0gaW5idWlsZGVyIHx8IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpXG4gICAgY29uc3Qgc3Vic3QgPSB7XG4gICAgICAnbml4LWJ1aWxkJzogJ2NhYmFsJyxcbiAgICAgICdub25lJzogJ2doY2knLFxuICAgIH1cbiAgICBidWlsZGVyID0gKHN1YnN0W2J1aWxkZXJdIHx8IGJ1aWxkZXIpXG5cbiAgICBjb25zdCB7Y3dkLCBjb21wLCBjYWJhbH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSSh0aGlzLnVyaSlcbiAgICB0aGlzLmN3ZCA9IGN3ZFxuXG4gICAgY29uc3QgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoYGlkZS1oYXNrZWxsLXJlcGwuJHtidWlsZGVyfVBhdGhgKVxuXG4gICAgY29uc3QgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBjb25zdCBleHRyYUFyZ3MgPSB7XG4gICAgICBzdGFjazogKHg6IHN0cmluZykgPT4gYC0tZ2hjaS1vcHRpb25zPVwiJHt4fVwiYCxcbiAgICAgIGNhYmFsOiAoeDogc3RyaW5nKSA9PiBgLS1naGMtb3B0aW9uPSR7eH1gLFxuICAgICAgZ2hjaTogKHg6IHN0cmluZykgPT4geCxcbiAgICB9XG5cbiAgICBpZiAoIWFyZ3NbYnVpbGRlcl0pIHsgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJ1aWxkZXIgJHtidWlsZGVyfWApIH1cbiAgICBjb25zdCBjb21tYW5kQXJncyA9IGFyZ3NbYnVpbGRlcl1cblxuICAgIGNvbW1hbmRBcmdzLnB1c2goLi4uKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5leHRyYUFyZ3MnKS5tYXAoZXh0cmFBcmdzW2J1aWxkZXJdKSkpXG5cbiAgICBpZiAoY29tcCAmJiBjYWJhbCkge1xuICAgICAgaWYgKGJ1aWxkZXIgPT09ICdzdGFjaycpIHtcbiAgICAgICAgY29uc3QgY29tcGMgPVxuICAgICAgICAgIGNvbXAuc3RhcnRzV2l0aCgnbGliOicpXG4gICAgICAgICAgPyAnbGliJ1xuICAgICAgICAgIDogY29tcFxuICAgICAgICBjb21tYW5kQXJncy5wdXNoKCctLW1haW4taXMnLCBgJHtjYWJhbC5uYW1lfToke2NvbXBjfWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21tYW5kQXJncy5wdXNoKGNvbXApXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jIChjb2RlKSA9PiB0aGlzLmRlc3Ryb3koKSxcbiAgICB9KVxuXG4gICAgY29uc3QgaW5pdHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuICAgIHRoaXMucHJvbXB0ID0gaW5pdHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIgKGluaXRyZXMuc3RkZXJyKVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGVycm9yc0Zyb21TdGRlcnIgKHN0ZGVycjogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcigoe190aW1lfSkgPT4gRGF0ZS5ub3coKSAtIF90aW1lIDwgMTAwMDApXG4gICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnIgb2Ygc3RkZXJyLmpvaW4oJ1xcbicpLnNwbGl0KC9cXG4oPz1cXFMpLykpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB0aGlzLnBhcnNlTWVzc2FnZShlcnIpXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgdGhpcy51cGkuc2V0TWVzc2FnZXModGhpcy5lcnJvcnMpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9XG4gICAgcmV0dXJuIGhhc0Vycm9yc1xuICB9XG5cbiAgcHJvdGVjdGVkIHVuaW5kZW50TWVzc2FnZSAobWVzc2FnZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50OiBudW1iZXIgfCBudWxsID0gbnVsbFxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pIVxuICAgICAgY29uc3QgbGluZUluZGVudCA9IG1hdGNoWzBdLmxlbmd0aFxuICAgICAgaWYgKCFtaW5JbmRlbnQgfHwgbGluZUluZGVudCA8IG1pbkluZGVudCkgeyBtaW5JbmRlbnQgPSBsaW5lSW5kZW50IH1cbiAgICB9XG4gICAgaWYgKG1pbkluZGVudCkge1xuICAgICAgbGluZXMgPSBsaW5lcy5tYXAoKGxpbmUpID0+IGxpbmUuc2xpY2UobWluSW5kZW50ISkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZSAocmF3OiBzdHJpbmcpOiBJRXJyb3JJdGVtIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMuY3dkKSB7IHJldHVybiB9XG4gICAgY29uc3QgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/WyBcXHRdKihcXFtbXlxcXV0rXFxdKT9bIFxcdF0qXFxuPyhbXl0qKS9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgW2ZpbGVjLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dCwgbXNnXTogQXJyYXk8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogVVBJLlRTZXZlcml0eSA9IHJhd1R5cCA/IHJhd1R5cC50b0xvd2VyQ2FzZSgpIDogJ2Vycm9yJ1xuICAgICAgICBsZXQgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgIGlmIChmaWxlYyA9PT0gJzxpbnRlcmFjdGl2ZT4nKSB7XG4gICAgICAgICAgZmlsZSA9IHVuZGVmaW5lZFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpbGUgPSBmaWxlY1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwb3NpdGlvbjogW3BhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLCBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxXSxcbiAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnVuaW5kZW50TWVzc2FnZSgobXNnIGFzIHN0cmluZyAmIHt0cmltUmlnaHQgKCk6IHN0cmluZ30pLnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=