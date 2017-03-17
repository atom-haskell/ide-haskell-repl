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
    static getRootDir(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            return Util.getRootDir(uri);
        });
    }
    static getCabalFile(rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            let cont = yield new Promise((resolve, reject) => rootDir.getEntries((error, contents) => {
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
            let cabalContents = yield cabalFile.read();
            return Util.parseDotCabal(cabalContents);
        });
    }
    static getComponent(cabalFile, uri) {
        return __awaiter(this, void 0, void 0, function* () {
            let cabalContents = yield cabalFile.read();
            let cwd = cabalFile.getParent();
            return Util.getComponentFromFile(cabalContents, cwd.relativize(uri));
        });
    }
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
            let res = yield this.ghci.reload();
            this.onReload();
            return res;
        });
    }
    ghciReloadRepeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let { stderr } = yield this.ghciReload();
            console.error(stderr);
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
            this.cwd = yield IdeHaskellReplBase.getRootDir(this.uri);
            let [cabalFile] = yield IdeHaskellReplBase.getCabalFile(this.cwd);
            let comp, cabal;
            if (cabalFile) {
                cabal = yield IdeHaskellReplBase.parseCabalFile(cabalFile);
                [comp] = yield IdeHaskellReplBase.getComponent(cabalFile, this.cwd.relativize(this.uri));
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
            this.update();
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
                return {
                    uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : null,
                    position: [parseInt(line, 10) - 1, parseInt(col, 10) - 1],
                    message: {
                        text: this.unindentMessage(msg.trimRight()),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsK0JBQTBCO0FBQzFCLDJDQUEwQztBQUMxQywyQ0FBaUM7QUFFakMsdURBQWdEO0FBQ2hELGlDQUEyQjtBQW1DM0I7SUFDUyxNQUFNLENBQU8sVUFBVSxDQUFFLEdBQUc7O1lBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQzdCLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxZQUFZLENBQUUsT0FBNEI7O1lBQzVELElBQUksSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQzFCLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVE7Z0JBQ3RELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1YsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO2dCQUNmLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO2dCQUNuQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUNwQixJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBcUIsQ0FBQTtRQUNqRixDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sY0FBYyxDQUFFLFNBQXlCOztZQUMzRCxJQUFJLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtZQUMxQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQTtRQUMxQyxDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sWUFBWSxDQUFFLFNBQXlCLEVBQUUsR0FBVzs7WUFDdEUsSUFBSSxhQUFhLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUE7WUFDMUMsSUFBSSxHQUFHLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFBO1lBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUN0RSxDQUFDO0tBQUE7SUFhRCxZQUFhLFVBQVUsRUFBRSxFQUN2QixHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxHQUNuRjtRQUNYLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFBO1FBQ2QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGdDQUFjLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDMUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGdCQUFnQixDQUFBO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFBO1FBRWhCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQTtRQUU3QixZQUFZLENBQUMscURBQVksTUFBTSxDQUFOLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUEsR0FBQSxDQUFDLENBQUE7SUFDdkQsQ0FBQztJQUlNLHNCQUFzQjtRQUMzQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUE7SUFDakQsQ0FBQztJQUVZLFVBQVUsQ0FBRSxPQUFlOztZQUN0QyxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzdCLElBQUksR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUk7Z0JBQ25ELE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO2dCQUN6QixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNiLEtBQUssT0FBTzt3QkFDVixJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7NEJBQ3pCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLDZCQUE2Qjt5QkFDbkUsQ0FBQyxDQUFBO3dCQUNGLEtBQUssQ0FBQTtvQkFDUCxLQUFLLFFBQVE7d0JBQ1gsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDOzRCQUN6QixJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsOEJBQThCO3lCQUNwRCxDQUFDLENBQUE7d0JBQ0YsS0FBSyxDQUFBO29CQUNQLEtBQUssUUFBUTt3QkFDWCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTt3QkFDckIsS0FBSyxDQUFBO29CQUNQLFNBQVMsS0FBSyxDQUFBO2dCQUNoQixDQUFDO2dCQUNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtZQUNmLENBQUMsQ0FBQyxDQUFBO1lBQ0YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNqQyxNQUFNLENBQUMsR0FBRyxDQUFBO1FBQ1osQ0FBQztLQUFBO0lBRVksVUFBVTs7WUFDckIsSUFBSSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1lBQ2xDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQTtZQUNmLE1BQU0sQ0FBQyxHQUFHLENBQUE7UUFDWixDQUFDO0tBQUE7SUFFWSxnQkFBZ0I7O1lBQzNCLElBQUksRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtZQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEMsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUE7Z0JBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ2pDLENBQUM7UUFDSCxDQUFDO0tBQUE7SUFFRCxJQUFXLGdCQUFnQixDQUFFLGdCQUF5QjtRQUNwRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsZ0JBQWdCLENBQUE7UUFDekMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO0lBQ2YsQ0FBQztJQUVELElBQVcsZ0JBQWdCO1FBQ3pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUE7SUFDL0IsQ0FBQztJQUVNLFNBQVM7UUFDZCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFBO0lBQ3ZCLENBQUM7SUFFWSxjQUFjLENBQUUsTUFBTTs7WUFDakMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNuQixNQUFNLENBQUMsRUFBRSxDQUFBO1lBQ1gsQ0FBQztZQUNELElBQUksRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQTtZQUN0RCxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUE7WUFDZCxNQUFNLENBQUMsbUJBQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQTtRQUMxRSxDQUFDO0tBQUE7SUFFTSxVQUFVLENBQUUsR0FBVyxFQUFFLEtBQXNCO1FBQ3BELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2YsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pELE1BQU0sQ0FBQzt3QkFDTCxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUk7d0JBQ2QsSUFBSSxFQUFFOzRCQUNKLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSTs0QkFDYixXQUFXLEVBQUUsbUJBQW1CO3lCQUNqQztxQkFDRixDQUFBO2dCQUNILENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFZSxhQUFhOztZQUMzQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ3RCLENBQUM7S0FBQTtJQUVlLFFBQVE7O1lBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUE7UUFDdEIsQ0FBQztLQUFBO0lBRWUsTUFBTTs7UUFFdEIsQ0FBQztLQUFBO0lBRWUsT0FBTzs7WUFDckIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ2QsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUNyQixDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRWUsVUFBVSxDQUFFLFVBQXdCOztZQUNsRCxJQUFJLENBQUMsR0FBRyxHQUFHLE1BQU0sVUFBVSxDQUFBO1lBQzNCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7WUFBQyxDQUFDO1lBRTVDLElBQUksQ0FBQztnQkFDSCxJQUFJLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxTQUFTLENBQUMsQ0FBQTtnQkFDdkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxDQUFDO1lBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDZixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNWLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRTt3QkFDakQsTUFBTSxFQUFFLEtBQUs7d0JBQ2IsV0FBVyxFQUFFLElBQUk7cUJBQ2xCLENBQUMsQ0FBQTtvQkFDRixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7Z0JBQ2hCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsb0RBQW9ELENBQUMsQ0FBQTtvQkFDbkYsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO2dCQUNoQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVlLE9BQU8sQ0FBRSxPQUFlOztZQUN0QyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLDhCQUE4QixDQUFDLENBQUE7WUFBQyxDQUFDO1lBQzNFLElBQUksS0FBSyxHQUFHO2dCQUNWLFdBQVcsRUFBRSxPQUFPO2dCQUNwQixNQUFNLEVBQUUsTUFBTTthQUNmLENBQUE7WUFDRCxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUE7WUFFckMsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLE1BQU0sa0JBQWtCLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUVqRSxJQUFJLElBQUksRUFBRSxLQUFLLENBQUE7WUFDZixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNkLEtBQUssR0FBRyxNQUFNLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0QsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7WUFDMUYsQ0FBQztZQUNELElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixPQUFPLE1BQU0sQ0FBQyxDQUFBO1lBRXBFLElBQUksSUFBSSxHQUFHO2dCQUNULEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQztnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUM7Z0JBQ2YsSUFBSSxFQUFFLEVBQUU7YUFDVCxDQUFBO1lBQ0QsSUFBSSxTQUFTLEdBQUc7Z0JBQ2QsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLHVCQUF1QjtnQkFDckMsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLG1CQUFtQjtnQkFDakMsSUFBSSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUM7YUFDZixDQUFBO1lBRUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQTtZQUFDLENBQUM7WUFDckUsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBRS9CLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUU1RixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNULEVBQUUsQ0FBQyxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUN4QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDNUIsSUFBSSxHQUFHLEtBQUssQ0FBQTtvQkFDZCxDQUFDO29CQUNELElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFLENBQUE7b0JBQzlCLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFBO2dCQUNyQyxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7Z0JBQUMsQ0FBQztZQUNuQyxDQUFDO1lBRUQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLFdBQUksQ0FBQztnQkFDbkIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO2dCQUMxQixPQUFPLEVBQUUsV0FBVztnQkFDcEIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRTtnQkFDdkIsTUFBTSxFQUFFLENBQU8sSUFBSSxvREFBSyxNQUFNLENBQU4sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBLEdBQUE7YUFDdkMsQ0FBQyxDQUFBO1lBRUYsSUFBSSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFBO1lBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUMvQixJQUFJLENBQUMsZ0JBQWdCLENBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ3RDLE1BQU0sSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFBO1lBQzFCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUNmLENBQUM7S0FBQTtJQUVlLFdBQVc7O1lBQ3pCLElBQUksRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQTtZQUN6RCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSTtnQkFDbEMsSUFBSSxFQUFFLEdBQUcsZ0RBQWdELENBQUE7Z0JBQ3pELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUE7Z0JBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1YsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDdEIsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNkLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtvQkFDZixJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtvQkFDckYsTUFBTSxDQUFDO3dCQUNMLEdBQUc7d0JBQ0gsSUFBSTt3QkFDSixJQUFJLEVBQUUsWUFBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7cUJBQ2pFLENBQUE7Z0JBQ0gsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFBO1FBQ0osQ0FBQztLQUFBO0lBRVMsZ0JBQWdCLENBQUUsTUFBZ0I7UUFDMUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsS0FBSyxFQUFDLEtBQUssSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQTtRQUN6RSxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUE7UUFDckIsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQTtnQkFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ3ZCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsU0FBUyxHQUFHLElBQUksQ0FBQTtnQkFDbEIsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBQ0QsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDYixJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUNmLENBQUM7UUFDRCxNQUFNLENBQUMsU0FBUyxDQUFBO0lBQ2xCLENBQUM7SUFFUyxlQUFlLENBQUUsT0FBTztRQUNoQyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUNoRSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUE7UUFDcEIsR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQzlCLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUE7WUFDaEMsRUFBRSxDQUFDLENBQUMsVUFBVSxHQUFHLFNBQVMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQTtZQUFDLENBQUM7UUFDdEUsQ0FBQztRQUNELE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBQy9CLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDZCxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUE7UUFDcEQsQ0FBQztRQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3pCLENBQUM7SUFFUyxZQUFZLENBQUUsR0FBRztRQUN6QixJQUFJLFFBQVEsR0FBRyxnREFBZ0QsQ0FBQTtRQUMvRCxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0IsSUFBSSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQTtZQUNqQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNaLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtnQkFDN0MsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBYSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUNuRSxJQUFJLEdBQUcsR0FBYSxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsRUFBRSxHQUFHLE9BQU8sQ0FBQTtnQkFDM0QsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLGVBQWUsQ0FBQyxDQUFDLENBQUM7b0JBQzdCLElBQUksR0FBRyxJQUFJLENBQUE7b0JBQ1gsR0FBRyxHQUFHLE1BQU0sQ0FBQTtnQkFDZCxDQUFDO2dCQUVELE1BQU0sQ0FBQztvQkFDTCxHQUFHLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSTtvQkFDeEUsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQWMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLEdBQWEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdFLE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7d0JBQzNDLFdBQVcsRUFBRSxzQkFBc0I7cUJBQ3BDO29CQUNELE9BQU8sRUFBRSxPQUFpQjtvQkFDMUIsUUFBUSxFQUFFLEdBQUc7b0JBQ2IsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7aUJBQ2xCLENBQUE7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDO29CQUNMLE9BQU8sRUFBRSxHQUFHO29CQUNaLFFBQVEsRUFBRSxNQUFNO29CQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBcFVELGdEQW9VQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UmFuZ2V9IGZyb20gJ2F0b20nXG5pbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQge0NvbW1hbmRIaXN0b3J5fSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7R0hDSX0gZnJvbSAnLi9naGNpJ1xuXG50eXBlIFVQSSA9IGFueVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbiAgaGxjYWNoZT86IHN0cmluZ1xufVxuXG50eXBlIFNldmVyaXR5ID0gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdyZXBsJyB8IHN0cmluZ1xuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0ge1xuICB1cmk/OiBzdHJpbmcsXG4gIHBvc2l0aW9uPzogW251bWJlciwgbnVtYmVyXSxcbiAgbWVzc2FnZTogc3RyaW5nIHwgeyB0ZXh0OiBzdHJpbmcsIGhpZ2hsaWdodGVyOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5pbnRlcmZhY2UgSVR5cGVSZWNvcmQge1xuICB1cmk6IHN0cmluZ1xuICB0eXBlOiBzdHJpbmdcbiAgc3BhbjogUmFuZ2Vcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpciAodXJpKSB7XG4gICAgcmV0dXJuIFV0aWwuZ2V0Um9vdERpcih1cmkpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldENhYmFsRmlsZSAocm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSk6IFByb21pc2U8QXRvbVR5cGVzLkZpbGVbXT4ge1xuICAgIGxldCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHJldHVybiBjb250LmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlQ2FiYWxGaWxlIChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlKTogUHJvbWlzZTxVdGlsLklEb3RDYWJhbD4ge1xuICAgIGxldCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIHJldHVybiBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q29tcG9uZW50IChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLCB1cmk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBsZXQgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICBsZXQgY3dkID0gY2FiYWxGaWxlLmdldFBhcmVudCgpXG4gICAgcmV0dXJuIFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGUoY2FiYWxDb250ZW50cywgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgfVxuXG4gIHByb3RlY3RlZCBnaGNpOiBHSENJXG4gIHByb3RlY3RlZCBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk6IFVQSVxuICBwcm90ZWN0ZWQgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByb3RlY3RlZCBlcnJvcnM6IElFcnJvckl0ZW1bXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcm90ZWN0ZWQgdHlwZXM6IElUeXBlUmVjb3JkW11cblxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZSwge1xuICAgIHVyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gIH06IElWaWV3U3RhdGUpIHtcbiAgICB0aGlzLnVyaSA9IHVyaVxuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy5lcnJvcnMgPSBbXVxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSkpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgdXBkYXRlICgpXG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICEgdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgbGV0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgbGV0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKHR5cGUsIHRleHQpID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IodHlwZSwgdGV4dClcbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dDogaW5wLmpvaW4oJ1xcbicpLCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGV4dCwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IHRleHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OiBicmVha1xuICAgICAgfVxuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQgKCkge1xuICAgIGxldCByZXMgPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCAoKSB7XG4gICAgbGV0IHtzdGRlcnJ9ID0gYXdhaXQgdGhpcy5naGNpUmVsb2FkKClcbiAgICBjb25zb2xlLmVycm9yKHN0ZGVycilcbiAgICBpZiAoISB0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKSkge1xuICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLmhpc3RvcnkuZ29CYWNrKCcnKVxuICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdCAoYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhbikge1xuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldCBhdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMgKHByZWZpeCkge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGxldCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIHN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihzdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe3RleHQ6IHRleHQuc2xpY2UoMSwgLTEpfSkpXG4gIH1cblxuICBwdWJsaWMgc2hvd1R5cGVBdCAodXJpOiBzdHJpbmcsIHJhbmdlOiBBdG9tVHlwZXMuUmFuZ2UpIHtcbiAgICBpZiAodGhpcy50eXBlcykge1xuICAgICAgZm9yIChsZXQgdHIgb2YgdGhpcy50eXBlcykge1xuICAgICAgICBpZiAodHIgJiYgdHIudXJpID09PSB1cmkgJiYgdHIuc3Bhbi5jb250YWluc1JhbmdlKHJhbmdlKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByYW5nZTogdHIuc3BhbixcbiAgICAgICAgICAgIHRleHQ6IHtcbiAgICAgICAgICAgICAgdGV4dDogdHIudHlwZSxcbiAgICAgICAgICAgICAgaGlnaGxpZ2h0ZXI6ICdoaW50LnR5cGUuaGFza2VsbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uUmVsb2FkICgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCAoKSB7XG4gICAgLy8gbm9vcFxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLmdoY2kpIHtcbiAgICAgIHRoaXMuZ2hjaS5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaW5pdGlhbGl6ZSAodXBpUHJvbWlzZTogUHJvbWlzZTxVUEk+KSB7XG4gICAgdGhpcy51cGkgPSBhd2FpdCB1cGlQcm9taXNlXG4gICAgaWYgKCF0aGlzLnVwaSkgeyByZXR1cm4gdGhpcy5ydW5SRVBMKG51bGwpIH1cblxuICAgIHRyeSB7XG4gICAgICBsZXQgYnVpbGRlciA9IGF3YWl0IHRoaXMudXBpLnBhcmFtcy5nZXQoJ2lkZS1oYXNrZWxsLWNhYmFsJywgJ2J1aWxkZXInKVxuICAgICAgdGhpcy5ydW5SRVBMKChidWlsZGVyIHx8IHt9KS5uYW1lKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcIkNhbid0IHJ1biBSRVBMIHdpdGhvdXQga25vd2luZyB3aGF0IGJ1aWxkZXIgdG8gdXNlXCIpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJ1blJFUEwgKGJ1aWxkZXI6IHN0cmluZykge1xuICAgIGlmICghYnVpbGRlcikgeyBidWlsZGVyID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJykgfVxuICAgIGxldCBzdWJzdCA9IHtcbiAgICAgICduaXgtYnVpbGQnOiAnY2FiYWwnLFxuICAgICAgJ25vbmUnOiAnZ2hjaScsXG4gICAgfVxuICAgIGJ1aWxkZXIgPSAoc3Vic3RbYnVpbGRlcl0gfHwgYnVpbGRlcilcblxuICAgIHRoaXMuY3dkID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldFJvb3REaXIodGhpcy51cmkpXG4gICAgbGV0IFtjYWJhbEZpbGVdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENhYmFsRmlsZSh0aGlzLmN3ZClcblxuICAgIGxldCBjb21wLCBjYWJhbFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGNhYmFsID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLnBhcnNlQ2FiYWxGaWxlKGNhYmFsRmlsZSk7XG4gICAgICBbY29tcF0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Q29tcG9uZW50KGNhYmFsRmlsZSwgdGhpcy5jd2QucmVsYXRpdml6ZSh0aGlzLnVyaSkpXG4gICAgfVxuICAgIGxldCBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldChgaWRlLWhhc2tlbGwtcmVwbC4ke2J1aWxkZXJ9UGF0aGApXG5cbiAgICBsZXQgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBsZXQgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4KSA9PiAnLS1naGNpLW9wdGlvbnM9XCIje3h9XCInLFxuICAgICAgY2FiYWw6ICh4KSA9PiAnLS1naGMtb3B0aW9uPSN7eH0nLFxuICAgICAgZ2hjaTogKHgpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcignVW5rbm93biBidWlsZGVyICN7YnVpbGRlcn0nKSB9XG4gICAgbGV0IGNvbW1hbmRBcmdzID0gYXJnc1tidWlsZGVyXVxuXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi4oYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpLm1hcChleHRyYUFyZ3NbYnVpbGRlcl0pKSlcblxuICAgIGlmIChjb21wKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBpZiAoY29tcC5zdGFydHNXaXRoKCdsaWI6JykpIHtcbiAgICAgICAgICBjb21wID0gJ2xpYidcbiAgICAgICAgfVxuICAgICAgICBjb21wID0gYCR7Y2FiYWwubmFtZX06JHtjb21wfWBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgY29tcClcbiAgICAgIH0gZWxzZSB7IGNvbW1hbmRBcmdzLnB1c2goY29tcCkgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGxldCBpbml0cmVzID0gYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG4gICAgdGhpcy5wcm9tcHQgPSBpbml0cmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVyciAoaW5pdHJlcy5zdGRlcnIpXG4gICAgYXdhaXQgdGhpcy5vbkluaXRpYWxMb2FkKClcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZ2V0QWxsVHlwZXMgKCk6IFByb21pc2U8SVR5cGVSZWNvcmRbXT4ge1xuICAgIGxldCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKFsnOmFsbC10eXBlcyddKVxuICAgIHJldHVybiB0aGlzLnR5cGVzID0gc3Rkb3V0Lm1hcCgobGluZSkgPT4ge1xuICAgICAgbGV0IHJ4ID0gL14oLiopOlxcKChcXGQrKSwoXFxkKylcXCktXFwoKFxcZCspLChcXGQrKVxcKTpcXHMqKC4qKSQvXG4gICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKHJ4KVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGxldCBtID0gbWF0Y2guc2xpY2UoMSlcbiAgICAgICAgbGV0IHVyaSA9IG1bMF1cbiAgICAgICAgbGV0IHR5cGUgPSBtWzVdXG4gICAgICAgIGxldCBbcm93c3RhcnQsIGNvbHN0YXJ0LCByb3dlbmQsIGNvbGVuZF0gPSBtLnNsaWNlKDEpLm1hcCgoaSkgPT4gcGFyc2VJbnQoaSwgMTApIC0gMSlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmksXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBzcGFuOiBSYW5nZS5mcm9tT2JqZWN0KFtbcm93c3RhcnQsIGNvbHN0YXJ0XSwgW3Jvd2VuZCwgY29sZW5kXV0pLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIHByb3RlY3RlZCBlcnJvcnNGcm9tU3RkZXJyIChzdGRlcnI6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5maWx0ZXIoKHtfdGltZX0pID0+IERhdGUubm93KCkgLSBfdGltZSA8IDEwMDAwKVxuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGZvciAobGV0IGVyciBvZiBzdGRlcnIuam9pbignXFxuJykuc3BsaXQoL1xcbig/PVxcUykvKSkge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBsZXQgZXJyb3IgPSB0aGlzLnBhcnNlTWVzc2FnZShlcnIpXG4gICAgICAgIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgIGhhc0Vycm9ycyA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIHRoaXMudXBpLm1lc3NhZ2VzLnNldCh0aGlzLmVycm9ycylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH1cbiAgICByZXR1cm4gaGFzRXJyb3JzXG4gIH1cblxuICBwcm90ZWN0ZWQgdW5pbmRlbnRNZXNzYWdlIChtZXNzYWdlKTogc3RyaW5nIHtcbiAgICBsZXQgbGluZXMgPSBtZXNzYWdlLnNwbGl0KCdcXG4nKS5maWx0ZXIoKHgpID0+ICF4Lm1hdGNoKC9eXFxzKiQvKSlcbiAgICBsZXQgbWluSW5kZW50ID0gbnVsbFxuICAgIGZvciAobGV0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGxldCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqLylcbiAgICAgIGxldCBsaW5lSW5kZW50ID0gbWF0Y2hbMF0ubGVuZ3RoXG4gICAgICBpZiAobGluZUluZGVudCA8IG1pbkluZGVudCB8fCAhbWluSW5kZW50KSB7IG1pbkluZGVudCA9IGxpbmVJbmRlbnQgfVxuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKG1pbkluZGVudCwgbGluZXMpXG4gICAgaWYgKG1pbkluZGVudCkge1xuICAgICAgbGluZXMgPSBsaW5lcy5tYXAoKGxpbmUpID0+IGxpbmUuc2xpY2UobWluSW5kZW50KSlcbiAgICB9XG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGFyc2VNZXNzYWdlIChyYXcpOiBJRXJyb3JJdGVtIHtcbiAgICBsZXQgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/XFxzKihcXFtbXlxcXV0rXFxdKT8vXG4gICAgaWYgKHJhdyAmJiByYXcudHJpbSgpICE9PSAnJykge1xuICAgICAgbGV0IG1hdGNoZWQgPSByYXcubWF0Y2gobWF0Y2hMb2MpXG4gICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICBsZXQgbXNnID0gcmF3LnNwbGl0KCdcXG4nKS5zbGljZSgxKS5qb2luKCdcXG4nKVxuICAgICAgICBsZXQgW2ZpbGUsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0XTogc3RyaW5nW10gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFNldmVyaXR5ID0gcmF3VHlwID8gcmF3VHlwLnRvTG93ZXJDYXNlKCkgOiAnZXJyb3InXG4gICAgICAgIGlmIChmaWxlID09PSAnPGludGVyYWN0aXZlPicpIHtcbiAgICAgICAgICBmaWxlID0gbnVsbFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IG51bGwsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UobXNnLnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dDogY29udGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19