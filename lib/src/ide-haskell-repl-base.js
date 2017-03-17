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
const atom_1 = require("atom");
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
class IdeHaskellReplBase {
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }) {
        this.uri = uri;
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
            let inp = command.split('\n');
            let res = yield this.ghci.writeLines(inp, (type, text) => {
                console.error(type, text);
                switch (type) {
                    case 'stdin':
                        text && this.messages.push({ text: inp.join('\n'), hl: true, cls: 'ide-haskell-repl-input-text' });
                        break;
                    case 'stdout':
                        text && this.messages.push({ text, hl: true, cls: 'ide-haskell-repl-output-text' });
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
            let res = yield this.ghci.reload();
            this.onReload();
            return res;
        });
    }
    ghciReloadRepeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let { stderr } = yield this.ghci.reload();
            if (!this.errorsFromStderr(stderr)) {
                let command = this.history.goBack('');
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
            let { stdout } = yield this.ghci.sendCompletionRequest();
            stdout.shift();
            return fuzzaldrin_1.filter(stdout, prefix).map((text) => ({ text: text.slice(1, -1) }));
        });
    }
    showTypeAt(uri, range) {
        if (this.types) {
            for (let tr of this.types) {
                if (tr && tr.uri === uri && tr.span.containsRange(range)) {
                    return {
                        range: tr.span,
                        text: {
                            text: tr.type,
                            highlighter: 'hint.type.haskell',
                        },
                    };
                }
            }
        }
    }
    static getRootDir(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            return Util.getRootDir(uri);
        });
    }
    static getCabalFile(rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            let contants = yield new Promise((resolve, reject) => rootDir.getEntries((error, contents) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(contents);
                }
            }));
            return contents.filter((file) => file.isFile() && file.getBaseName().endsWith('.cabal'));
        });
    }
    static getComponent(cabalFile) {
        return __awaiter(this, void 0, void 0, function* () {
            let cabalContents = yield cabalFile.read();
            cabal = Util.parseDotCabalSync(cabalContents)[comp] = Util.getComponentFromFileSync(cabalContents, this.cwd.relativize(this.uri));
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
                let builder = yield this.upi.params.get('ide-haskell-cabal', 'builder');
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
    runREPL(builder) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!builder) {
                builder = atom.config.get('ide-haskell-repl.defaultRepl');
            }
            let subst = {
                'nix-build': 'cabal',
                'none': 'ghci',
            };
            builder = (subst[builder] || builder);
            this.cwd = Util.getRootDir(this.uri);
            let [cabalFile] = this.cwd.getEntriesSync().filter((file) => file.isFile() && file.getBaseName().endsWith('.cabal'));
            let cabal, comp;
            if (cabalFile) {
                let cabalContents = cabalFile.readSync();
                cabal = Util.parseDotCabalSync(cabalContents)[comp] = Util.getComponentFromFileSync(cabalContents, this.cwd.relativize(this.uri));
            }
            let commandPath = atom.config.get(`ide-haskell-repl.${builder}Path`);
            let args = {
                stack: ['ghci'],
                cabal: ['repl'],
                ghci: [],
            };
            let extraArgs = {
                stack: (x) => '--ghci-options="#{x}"',
                cabal: (x) => '--ghc-option=#{x}',
                ghci: (x) => x,
            };
            if (!args[builder]) {
                throw new Error('Unknown builder #{builder}');
            }
            let commandArgs = args[builder];
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
            let initres = yield this.ghci.waitReady();
            this.prompt = initres.prompt[1];
            this.errorsFromStderr(initres.stderr);
            yield this.onInitialLoad();
        });
    }
    getAllTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            let { stdout } = yield this.ghci.writeLines([':all-types']);
            return this.types = stdout.map((line) => {
                let rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/;
                let match = line.match(rx);
                if (match) {
                    let m = match.slice(1);
                    let uri = m[0];
                    let type = m[5];
                    let [rowstart, colstart, rowend, colend] = m.slice(1).map((i) => parseInt(i, 10) - 1);
                    return {
                        uri,
                        type,
                        span: atom_1.Range.fromObject([[rowstart, colstart], [rowend, colend]]),
                    };
                }
            });
        });
    }
    errorsFromStderr(stderr) {
        this.errors = this.errors.filter(({ _time }) => Date.now() - _time < 10000);
        let hasErrors = false;
        for (let err of stderr.join('\n').split(/\n(?=\S)/)) {
            if (err) {
                let error = this.parseMessage(err);
                this.errors.push(error);
                if (error.severity === 'error') {
                    hasErrors = true;
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
        for (let line of lines) {
            let match = line.match(/^\s*/);
            let lineIndent = match[0].length;
            if (lineIndent < minIndent || !minIndent) {
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
        let matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?\s*(\[[^\]]+\])?/;
        if (raw && raw.trim() !== '') {
            let matched = raw.match(matchLoc);
            if (matched) {
                let msg = raw.split('\n').slice(1).join('\n');
                let [file, line, col, rawTyp, context] = matched.slice(1);
                let typ = rawTyp ? rawTyp.toLowerCase() : 'error';
                if (file === '<interactive>') {
                    file = null;
                    typ = 'repl';
                }
                let msgany = msg;
                return {
                    uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : null,
                    position: [parseInt(line, 10) - 1, parseInt(col, 10) - 1],
                    message: {
                        text: this.unindentMessage(msgany.trimRight()),
                        highlighter: 'hint.message.haskell',
                    },
                    context: context,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsK0JBQTBCO0FBQzFCLDJDQUEwQztBQUMxQywyQ0FBaUM7QUFFakMsdURBQWdEO0FBQ2hELGlDQUEyQjtBQXNDM0I7SUFXRSxZQUFhLFVBQVUsRUFBRSxFQUN2QixHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxHQUNuRjtRQUNYLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFBO1FBQ2QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGdDQUFjLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDMUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGdCQUFnQixDQUFBO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFBO1FBRWhCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQTtRQUU3QixZQUFZLENBQUMscURBQVksTUFBTSxDQUFOLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUEsR0FBQSxDQUFDLENBQUE7SUFDdkQsQ0FBQztJQUlNLHNCQUFzQjtRQUMzQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUE7SUFDakQsQ0FBQztJQUVZLFVBQVUsQ0FBRSxPQUFlOztZQUN0QyxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzdCLElBQUksR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUk7Z0JBQ25ELE9BQU8sQ0FBQyxLQUFL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RSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUE5VEQsZ0RBOFRDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSYW5nZX0gZnJvbSAnYXRvbSdcbmltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7Q29tbWFuZEhpc3Rvcnl9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHtHSENJfSBmcm9tICcuL2doY2knXG5cbnR5cGUgVVBJID0gYW55XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdTdGF0ZSB7XG4gIHVyaT86IHN0cmluZ1xuICBoaXN0b3J5Pzogc3RyaW5nW11cbiAgYXV0b1JlbG9hZFJlcGVhdD86IGJvb2xlYW5cbiAgY29udGVudD86IElDb250ZW50SXRlbVtdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxufVxuXG50eXBlIFNldmVyaXR5ID0gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdyZXBsJyB8IHN0cmluZ1xuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0ge1xuICB1cmk/OiBzdHJpbmcsXG4gIHBvc2l0aW9uPzogW251bWJlciwgbnVtYmVyXSxcbiAgbWVzc2FnZTogc3RyaW5nIHwgeyB0ZXh0OiBzdHJpbmcsIGhpZ2hsaWdodGVyOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5kZWNsYXJlIGludGVyZmFjZSBJTXlTdHJpbmcgZXh0ZW5kcyBTdHJpbmcge1xuICB0cmltUmlnaHQgKCk6IElNeVN0cmluZ1xufVxuXG5pbnRlcmZhY2UgSVR5cGVSZWNvcmQge1xuICB1cmk6IHN0cmluZ1xuICB0eXBlOiBzdHJpbmdcbiAgc3BhbjogUmFuZ2Vcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHByb3RlY3RlZCBnaGNpOiBHSENJXG4gIHByb3RlY3RlZCBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk6IFVQSVxuICBwcm90ZWN0ZWQgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByb3RlY3RlZCBlcnJvcnM6IElFcnJvckl0ZW1bXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcm90ZWN0ZWQgdHlwZXM6IElUeXBlUmVjb3JkW11cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHtcbiAgICB1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICB9OiBJVmlld1N0YXRlKSB7XG4gICAgdGhpcy51cmkgPSB1cmlcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMuZXJyb3JzID0gW11cblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4gdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpKVxuICB9XG5cbiAgcHVibGljIGFic3RyYWN0IHVwZGF0ZSAoKVxuXG4gIHB1YmxpYyB0b2dnbGVBdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICB0aGlzLmF1dG9SZWxvYWRSZXBlYXQgPSAhIHRoaXMuYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkNvbW1hbmQgKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGxldCBpbnAgPSBjb21tYW5kLnNwbGl0KCdcXG4nKVxuICAgIGxldCByZXMgPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhpbnAsICh0eXBlLCB0ZXh0KSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKHR5cGUsIHRleHQpXG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RkaW4nOlxuICAgICAgICAgIHRleHQgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHt0ZXh0OiBpbnAuam9pbignXFxuJyksIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdzdGRvdXQnOlxuICAgICAgICAgIHRleHQgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHt0ZXh0LCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCd9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSB0ZXh0WzFdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDogYnJlYWtcbiAgICAgIH1cbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkICgpIHtcbiAgICBsZXQgcmVzID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQgKCkge1xuICAgIGxldCB7c3RkZXJyfSA9IGF3YWl0IHRoaXMuZ2hjaS5yZWxvYWQoKVxuICAgIGlmICghIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpKSB7XG4gICAgICBsZXQgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5nb0JhY2soJycpXG4gICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGNvbW1hbmQpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHNldCBhdXRvUmVsb2FkUmVwZWF0IChhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuKSB7XG4gICAgdGhpcy5fYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0IGF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyAocHJlZml4KSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgbGV0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHN0ZG91dCwgcHJlZml4KS5tYXAoKHRleHQpID0+ICh7dGV4dDogdGV4dC5zbGljZSgxLCAtMSl9KSlcbiAgfVxuXG4gIHB1YmxpYyBzaG93VHlwZUF0ICh1cmk6IHN0cmluZywgcmFuZ2U6IEF0b21UeXBlcy5SYW5nZSkge1xuICAgIGlmICh0aGlzLnR5cGVzKSB7XG4gICAgICBmb3IgKGxldCB0ciBvZiB0aGlzLnR5cGVzKSB7XG4gICAgICAgIGlmICh0ciAmJiB0ci51cmkgPT09IHVyaSAmJiB0ci5zcGFuLmNvbnRhaW5zUmFuZ2UocmFuZ2UpKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJhbmdlOiB0ci5zcGFuLFxuICAgICAgICAgICAgdGV4dDoge1xuICAgICAgICAgICAgICB0ZXh0OiB0ci50eXBlLFxuICAgICAgICAgICAgICBoaWdobGlnaHRlcjogJ2hpbnQudHlwZS5oYXNrZWxsJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRSb290RGlyKHVyaSkge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDYWJhbEZpbGUocm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSk6IEF0b21UeXBlcy5GaWxlIHtcbiAgICBsZXQgY29udGFudHMgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIHJlamVjdChlcnJvcilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUoY29udGVudHMpXG4gICAgICB9XG4gICAgfSkpXG4gICAgcmV0dXJuIGNvbnRlbnRzLmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDb21wb25lbnQoY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSkge1xuICAgIGxldCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIGNhYmFsID0gVXRpbC5wYXJzZURvdENhYmFsU3luYyhjYWJhbENvbnRlbnRzKVxuICAgIFtjb21wXSA9IFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGVTeW5jKGNhYmFsQ29udGVudHMsIHRoaXMuY3dkLnJlbGF0aXZpemUodGhpcy51cmkpKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZWxvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLm9uTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Mb2FkICgpIHtcbiAgICAvLyBub29wXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplICh1cGlQcm9taXNlOiBQcm9taXNlPFVQST4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7IHJldHVybiB0aGlzLnJ1blJFUEwobnVsbCkgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxldCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkucGFyYW1zLmdldCgnaWRlLWhhc2tlbGwtY2FiYWwnLCAnYnVpbGRlcicpXG4gICAgICB0aGlzLnJ1blJFUEwoKGJ1aWxkZXIgfHwge30pLm5hbWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvcixcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFwiQ2FuJ3QgcnVuIFJFUEwgd2l0aG91dCBrbm93aW5nIHdoYXQgYnVpbGRlciB0byB1c2VcIilcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTCAoYnVpbGRlcjogc3RyaW5nKSB7XG4gICAgaWYgKCFidWlsZGVyKSB7IGJ1aWxkZXIgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKSB9XG4gICAgbGV0IHN1YnN0ID0ge1xuICAgICAgJ25peC1idWlsZCc6ICdjYWJhbCcsXG4gICAgICAnbm9uZSc6ICdnaGNpJyxcbiAgICB9XG4gICAgYnVpbGRlciA9IChzdWJzdFtidWlsZGVyXSB8fCBidWlsZGVyKVxuXG4gICAgdGhpcy5jd2QgPSBVdGlsLmdldFJvb3REaXIodGhpcy51cmkpXG5cbiAgICBsZXQgW2NhYmFsRmlsZV0gPVxuICAgICAgdGhpcy5jd2QuZ2V0RW50cmllc1N5bmMoKS5maWx0ZXIoKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSlcblxuICAgIGxldCBjYWJhbCwgY29tcFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGxldCBjYWJhbENvbnRlbnRzID0gY2FiYWxGaWxlLnJlYWRTeW5jKClcbiAgICAgIGNhYmFsID0gVXRpbC5wYXJzZURvdENhYmFsU3luYyhjYWJhbENvbnRlbnRzKVxuICAgICAgW2NvbXBdID0gVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZVN5bmMoY2FiYWxDb250ZW50cywgdGhpcy5jd2QucmVsYXRpdml6ZSh0aGlzLnVyaSkpXG4gICAgfVxuICAgIGxldCBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldChgaWRlLWhhc2tlbGwtcmVwbC4ke2J1aWxkZXJ9UGF0aGApXG5cbiAgICBsZXQgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBsZXQgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4KSA9PiAnLS1naGNpLW9wdGlvbnM9XCIje3h9XCInLFxuICAgICAgY2FiYWw6ICh4KSA9PiAnLS1naGMtb3B0aW9uPSN7eH0nLFxuICAgICAgZ2hjaTogKHgpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcignVW5rbm93biBidWlsZGVyICN7YnVpbGRlcn0nKSB9XG4gICAgbGV0IGNvbW1hbmRBcmdzID0gYXJnc1tidWlsZGVyXVxuXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi4oYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpLm1hcChleHRyYUFyZ3NbYnVpbGRlcl0pKSlcblxuICAgIGlmIChjb21wKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBpZiAoY29tcC5zdGFydHNXaXRoKCdsaWI6JykpIHtcbiAgICAgICAgICBjb21wID0gJ2xpYidcbiAgICAgICAgfVxuICAgICAgICBjb21wID0gYCR7Y2FiYWwubmFtZX06JHtjb21wfWBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgY29tcClcbiAgICAgIH0gZWxzZSB7IGNvbW1hbmRBcmdzLnB1c2goY29tcCkgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGxldCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVyciAoaW5pdHJlcy5zdGRlcnIpXG4gICAgYXdhaXQgdGhpcy5vbkluaXRpYWxMb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBnZXRBbGxUeXBlcyAoKTogUHJvbWlzZTxJVHlwZVJlY29yZFtdPiB7XG4gICAgbGV0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoWyc6YWxsLXR5cGVzJ10pXG4gICAgcmV0dXJuIHRoaXMudHlwZXMgPSBzdGRvdXQubWFwKChsaW5lKSA9PiB7XG4gICAgICBsZXQgcnggPSAvXiguKik6XFwoKFxcZCspLChcXGQrKVxcKS1cXCgoXFxkKyksKFxcZCspXFwpOlxccyooLiopJC9cbiAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2gocngpXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgbGV0IG0gPSBtYXRjaC5zbGljZSgxKVxuICAgICAgICBsZXQgdXJpID0gbVswXVxuICAgICAgICBsZXQgdHlwZSA9IG1bNV1cbiAgICAgICAgbGV0IFtyb3dzdGFydCwgY29sc3RhcnQsIHJvd2VuZCwgY29sZW5kXSA9IG0uc2xpY2UoMSkubWFwKChpKSA9PiBwYXJzZUludChpLCAxMCkgLSAxKVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVyaSxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHNwYW46IFJhbmdlLmZyb21PYmplY3QoW1tyb3dzdGFydCwgY29sc3RhcnRdLCBbcm93ZW5kLCBjb2xlbmRdXSksXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJvdGVjdGVkIGVycm9yc0Zyb21TdGRlcnIgKHN0ZGVycjogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcigoe190aW1lfSkgPT4gRGF0ZS5ub3coKSAtIF90aW1lIDwgMTAwMDApXG4gICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChsZXQgZXJyIG9mIHN0ZGVyci5qb2luKCdcXG4nKS5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGxldCBlcnJvciA9IHRoaXMucGFyc2VNZXNzYWdlKGVycilcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChlcnJvcilcbiAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgdGhpcy51cGkubWVzc2FnZXMuc2V0KHRoaXMuZXJyb3JzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UgKG1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQgPSBudWxsXG4gICAgZm9yIChsZXQgbGluZSBvZiBsaW5lcykge1xuICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgbGV0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgIGlmIChsaW5lSW5kZW50IDwgbWluSW5kZW50IHx8ICFtaW5JbmRlbnQpIHsgbWluSW5kZW50ID0gbGluZUluZGVudCB9XG4gICAgfVxuICAgIGNvbnNvbGUuZXJyb3IobWluSW5kZW50LCBsaW5lcylcbiAgICBpZiAobWluSW5kZW50KSB7XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaW5JbmRlbnQpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByb3RlY3RlZCBwYXJzZU1lc3NhZ2UgKHJhdyk6IElFcnJvckl0ZW0ge1xuICAgIGxldCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9cXHMqKFxcW1teXFxdXStcXF0pPy9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBsZXQgbWF0Y2hlZCA9IHJhdy5tYXRjaChtYXRjaExvYylcbiAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgIGxldCBtc2cgPSByYXcuc3BsaXQoJ1xcbicpLnNsaWNlKDEpLmpvaW4oJ1xcbicpXG4gICAgICAgIGxldCBbZmlsZSwgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHRdOiBTdHJpbmdbXSA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgaWYgKGZpbGUgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSBudWxsXG4gICAgICAgICAgdHlwID0gJ3JlcGwnXG4gICAgICAgIH1cblxuICAgICAgICAvLyBOT1RFOiB0aGlzIGlzIGRvbmUgYmVjYXVzZSB0eXBlc2NyaXB0IGluc2lzdHMgc3RyaW5ncyBkb250IGhhdmVcbiAgICAgICAgLy8gdHJpbVJpZ2h0KCkgbWV0aG9kXG4gICAgICAgIGxldCBtc2dhbnkgPSBtc2cgYXMgSU15U3RyaW5nXG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IG51bGwsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UobXNnYW55LnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dDogY29udGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19