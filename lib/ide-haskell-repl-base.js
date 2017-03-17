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
        this.messages = content || [];
        setImmediate(() => __awaiter(this, void 0, void 0, function* () { return this.initialize(upiPromise); }));
    }
    toggleAutoReloadRepeat() {
        this.autoReloadRepeat = !this.autoReloadRepeat;
    }
    runCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            const inp = command.split('\n');
            const res = yield this.ghci.writeLines(inp, (type, text) => {
                console.error(type, text);
                switch (type) {
                    case 'stdin':
                        text && this.messages.push({
                            text: inp.join('\n'), hl: true, cls: 'ide-haskell-repl-input-text',
                        });
                        break;
                    case 'stdout':
                        text && this.messages.push({
                            text, hl: true, cls: 'ide-haskell-repl-output-text',
                        });
                        break;
                    case 'prompt':
                        this.prompt = text[1];
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
        this.ghci.interrupt();
    }
    getCompletions(prefix) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!prefix.trim()) {
                return [];
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
                const builder = yield this.upi.params.get('ide-haskell-cabal', 'builder');
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
                stack: (x) => '--ghci-options="#{x}"',
                cabal: (x) => '--ghc-option=#{x}',
                ghci: (x) => x,
            };
            if (!args[builder]) {
                throw new Error('Unknown builder #{builder}');
            }
            const commandArgs = args[builder];
            commandArgs.push(...(atom.config.get('ide-haskell-repl.extraArgs').map(extraArgs[builder])));
            if (comp) {
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
            this.upi.messages.set(this.errors);
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
        console.error(minIndent, lines);
        if (minIndent) {
            lines = lines.map((line) => line.slice(minIndent));
        }
        return lines.join('\n');
    }
    parseMessage(raw) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBNkIzQjtJQUNTLE1BQU0sQ0FBTyxVQUFVLENBQUUsR0FBRzs7WUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDN0IsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFPLFlBQVksQ0FBRSxPQUE0Qjs7WUFDNUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtnQkFDdEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2YsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7Z0JBQ25CLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFBO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFxQixDQUFBO1FBQ2pGLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxjQUFjLENBQUUsU0FBeUI7O1lBQzNELE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQzFDLENB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QUFHLEdBQUcsTUFBTSxDQUFBO2dCQUNkLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sSUFBSSxHQUFHLEtBQUssQ0FBQTtnQkFDZCxDQUFDO2dCQUVELE1BQU0sQ0FBQztvQkFDTCxHQUFHLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsU0FBUztvQkFDN0UsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQWMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLEdBQWEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdFLE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQzNDLFdBQVcsRUFBRSxzQkFBc0I7cUJBQ3BDO29CQUNELE9BQU87b0JBQ1AsUUFBUSxFQUFFLEdBQUc7b0JBQ2IsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7aUJBQ2xCLENBQUE7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDO29CQUNMLE9BQU8sRUFBRSxHQUFHO29CQUNaLFFBQVEsRUFBRSxNQUFNO29CQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBcFNELGdEQW9TQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UmFuZ2V9IGZyb20gJ2F0b20nXG5pbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQge0NvbW1hbmRIaXN0b3J5fSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7R0hDSX0gZnJvbSAnLi9naGNpJ1xuXG50eXBlIFVQSSA9IGFueVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbiAgaGxjYWNoZT86IHN0cmluZ1xufVxuXG50eXBlIFNldmVyaXR5ID0gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdyZXBsJyB8IHN0cmluZ1xuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0ge1xuICB1cmk/OiBzdHJpbmcsXG4gIHBvc2l0aW9uPzogW251bWJlciwgbnVtYmVyXSxcbiAgbWVzc2FnZTogc3RyaW5nIHwgeyB0ZXh0OiBzdHJpbmcsIGhpZ2hsaWdodGVyOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyICh1cmkpIHtcbiAgICByZXR1cm4gVXRpbC5nZXRSb290RGlyKHVyaSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q2FiYWxGaWxlIChyb290RGlyOiBBdG9tVHlwZXMuRGlyZWN0b3J5KTogUHJvbWlzZTxBdG9tVHlwZXMuRmlsZVtdPiB7XG4gICAgY29uc3QgY29udCA9IGF3YWl0IG5ldyBQcm9taXNlPEFycmF5PEF0b21UeXBlcy5EaXJlY3RvcnkgfCBBdG9tVHlwZXMuRmlsZT4+KFxuICAgICAgKHJlc29sdmUsIHJlamVjdCkgPT4gcm9vdERpci5nZXRFbnRyaWVzKChlcnJvciwgY29udGVudHMpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoY29udGVudHMpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICByZXR1cm4gY29udC5maWx0ZXIoKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSkgYXMgQXRvbVR5cGVzLkZpbGVbXVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBwYXJzZUNhYmFsRmlsZSAoY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSk6IFByb21pc2U8VXRpbC5JRG90Q2FiYWwgfCBudWxsPiB7XG4gICAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICByZXR1cm4gVXRpbC5wYXJzZURvdENhYmFsKGNhYmFsQ29udGVudHMpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldENvbXBvbmVudCAoY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSwgdXJpOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICBjb25zdCBjd2QgPSBjYWJhbEZpbGUuZ2V0UGFyZW50KClcbiAgICByZXR1cm4gVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZShjYWJhbENvbnRlbnRzLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICB9XG5cbiAgcHJvdGVjdGVkIGdoY2k6IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZDogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcm90ZWN0ZWQgcHJvbXB0OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHVwaTogVVBJXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdXG4gIHByb3RlY3RlZCBfYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhblxuICBwcm90ZWN0ZWQgaGlzdG9yeTogQ29tbWFuZEhpc3RvcnlcbiAgcHJvdGVjdGVkIHVyaTogc3RyaW5nXG5cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHtcbiAgICB1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICB9OiBJVmlld1N0YXRlKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMuZXJyb3JzID0gW11cblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4gdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpKVxuICB9XG5cbiAgcHVibGljIGFic3RyYWN0IHVwZGF0ZSAoKVxuXG4gIHB1YmxpYyB0b2dnbGVBdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICB0aGlzLmF1dG9SZWxvYWRSZXBlYXQgPSAhIHRoaXMuYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkNvbW1hbmQgKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGNvbnN0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAodHlwZSwgdGV4dCkgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcih0eXBlLCB0ZXh0KVxuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0ZGluJzpcbiAgICAgICAgICB0ZXh0ICYmIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBpbnAuam9pbignXFxuJyksIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICB0ZXh0ICYmIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0ZXh0LCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCcsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdwcm9tcHQnOlxuICAgICAgICAgIHRoaXMucHJvbXB0ID0gdGV4dFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6IGJyZWFrXG4gICAgICB9XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZCAoKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQgKCkge1xuICAgIGNvbnN0IHtzdGRlcnJ9ID0gYXdhaXQgdGhpcy5naGNpUmVsb2FkKClcbiAgICBpZiAoISB0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKSkge1xuICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5nb0JhY2soJycpXG4gICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHNldCBhdXRvUmVsb2FkUmVwZWF0IChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyAocHJlZml4KSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCB0aGlzLmdoY2kuc2VuZENvbXBsZXRpb25SZXF1ZXN0KClcbiAgICBzdGRvdXQuc2hpZnQoKVxuICAgIHJldHVybiBmaWx0ZXIoc3Rkb3V0LCBwcmVmaXgpLm1hcCgodGV4dCkgPT4gKHt0ZXh0OiB0ZXh0LnNsaWNlKDEsIC0xKX0pKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZWxvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkICgpIHtcbiAgICAvLyBub29wXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplICh1cGlQcm9taXNlOiBQcm9taXNlPFVQST4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7IHJldHVybiB0aGlzLnJ1blJFUEwobnVsbCkgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5wYXJhbXMuZ2V0KCdpZGUtaGFza2VsbC1jYWJhbCcsICdidWlsZGVyJylcbiAgICAgIHRoaXMucnVuUkVQTCgoYnVpbGRlciB8fCB7fSkubmFtZSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXCJDYW4ndCBydW4gUkVQTCB3aXRob3V0IGtub3dpbmcgd2hhdCBidWlsZGVyIHRvIHVzZVwiKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBydW5SRVBMIChpbmJ1aWxkZXI6IHN0cmluZyB8IG51bGwpIHtcbiAgICBsZXQgYnVpbGRlciA9IGluYnVpbGRlciB8fCBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKVxuICAgIGNvbnN0IHN1YnN0ID0ge1xuICAgICAgJ25peC1idWlsZCc6ICdjYWJhbCcsXG4gICAgICAnbm9uZSc6ICdnaGNpJyxcbiAgICB9XG4gICAgYnVpbGRlciA9IChzdWJzdFtidWlsZGVyXSB8fCBidWlsZGVyKVxuXG4gICAgdGhpcy5jd2QgPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Um9vdERpcih0aGlzLnVyaSlcbiAgICBjb25zdCBbY2FiYWxGaWxlXSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRDYWJhbEZpbGUodGhpcy5jd2QpXG5cbiAgICBsZXQgY29tcCwgY2FiYWxcbiAgICBpZiAoY2FiYWxGaWxlKSB7XG4gICAgICBjYWJhbCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5wYXJzZUNhYmFsRmlsZShjYWJhbEZpbGUpO1xuICAgICAgW2NvbXBdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENvbXBvbmVudChjYWJhbEZpbGUsIHRoaXMuY3dkLnJlbGF0aXZpemUodGhpcy51cmkpKVxuICAgIH1cbiAgICBjb25zdCBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldChgaWRlLWhhc2tlbGwtcmVwbC4ke2J1aWxkZXJ9UGF0aGApXG5cbiAgICBjb25zdCBhcmdzID0ge1xuICAgICAgc3RhY2s6IFsnZ2hjaSddLFxuICAgICAgY2FiYWw6IFsncmVwbCddLFxuICAgICAgZ2hjaTogW10sXG4gICAgfVxuICAgIGNvbnN0IGV4dHJhQXJncyA9IHtcbiAgICAgIHN0YWNrOiAoeCkgPT4gJy0tZ2hjaS1vcHRpb25zPVwiI3t4fVwiJyxcbiAgICAgIGNhYmFsOiAoeCkgPT4gJy0tZ2hjLW9wdGlvbj0je3h9JyxcbiAgICAgIGdoY2k6ICh4KSA9PiB4LFxuICAgIH1cblxuICAgIGlmICghYXJnc1tidWlsZGVyXSkgeyB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gYnVpbGRlciAje2J1aWxkZXJ9JykgfVxuICAgIGNvbnN0IGNvbW1hbmRBcmdzID0gYXJnc1tidWlsZGVyXVxuXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi4oYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpLm1hcChleHRyYUFyZ3NbYnVpbGRlcl0pKSlcblxuICAgIGlmIChjb21wKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBpZiAoY29tcC5zdGFydHNXaXRoKCdsaWI6JykpIHtcbiAgICAgICAgICBjb21wID0gJ2xpYidcbiAgICAgICAgfVxuICAgICAgICBjb21wID0gYCR7Y2FiYWwubmFtZX06JHtjb21wfWBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgY29tcClcbiAgICAgIH0gZWxzZSB7IGNvbW1hbmRBcmdzLnB1c2goY29tcCkgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGNvbnN0IGluaXRyZXMgPSBhd2FpdCB0aGlzLmdoY2kud2FpdFJlYWR5KClcbiAgICB0aGlzLnByb21wdCA9IGluaXRyZXMucHJvbXB0WzFdXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyIChpbml0cmVzLnN0ZGVycilcbiAgICBhd2FpdCB0aGlzLm9uSW5pdGlhbExvYWQoKVxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHByb3RlY3RlZCBlcnJvcnNGcm9tU3RkZXJyIChzdGRlcnI6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5maWx0ZXIoKHtfdGltZX0pID0+IERhdGUubm93KCkgLSBfdGltZSA8IDEwMDAwKVxuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgZXJyIG9mIHN0ZGVyci5qb2luKCdcXG4nKS5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKGVycm9yKVxuICAgICAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIHRoaXMudXBpLm1lc3NhZ2VzLnNldCh0aGlzLmVycm9ycylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH1cbiAgICByZXR1cm4gaGFzRXJyb3JzXG4gIH1cblxuICBwcm90ZWN0ZWQgdW5pbmRlbnRNZXNzYWdlIChtZXNzYWdlKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50ID0gbnVsbFxuICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pXG4gICAgICBjb25zdCBsaW5lSW5kZW50ID0gbWF0Y2hbMF0ubGVuZ3RoXG4gICAgICBpZiAoIW1pbkluZGVudCB8fCBsaW5lSW5kZW50IDwgbWluSW5kZW50KSB7IG1pbkluZGVudCA9IGxpbmVJbmRlbnQgfVxuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKG1pbkluZGVudCwgbGluZXMpXG4gICAgaWYgKG1pbkluZGVudCkge1xuICAgICAgbGluZXMgPSBsaW5lcy5tYXAoKGxpbmUpID0+IGxpbmUuc2xpY2UobWluSW5kZW50KSlcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGFyc2VNZXNzYWdlIChyYXcpOiBJRXJyb3JJdGVtIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9cXHMqKFxcW1teXFxdXStcXF0pPy9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBjb25zdCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgY29uc3QgbXNnID0gcmF3LnNwbGl0KCdcXG4nKS5zbGljZSgxKS5qb2luKCdcXG4nKVxuICAgICAgICBjb25zdCBbZmlsZWMsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0XTogQXJyYXk8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgbGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgICBpZiAoZmlsZWMgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSB1bmRlZmluZWRcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWxlID0gZmlsZWNcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlID8gdGhpcy5jd2QuZ2V0RmlsZSh0aGlzLmN3ZC5yZWxhdGl2aXplKGZpbGUpKS5nZXRQYXRoKCkgOiB1bmRlZmluZWQsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UobXNnLnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=