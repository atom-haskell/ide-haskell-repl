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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsK0JBQTBCO0FBQzFCLDJDQUEwQztBQUMxQywyQ0FBaUM7QUFFakMsdURBQWdEO0FBQ2hELGlDQUEyQjtBQXNDM0I7SUFDUyxNQUFNLENBQU8sVUFBVSxDQUFFLEdBQUc7O1lBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQzdCLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxZQUFZLENBQUUsT0FBNEI7O1lBQzVELElBQUksSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQzFCLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVE7Z0JBQ3RELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1YsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO2dCQUNmLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO2dCQUNuQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUNwQixJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBcUIsQ0FBQTtRQUNqRixDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sY0FBYyxDQUFFLFNBQXlCOztZQUMzRCxJQUFJLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtZQUMxQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQTtRQUMxQyxDQUFDO0tBQUE7SUFFTSxNQUFNLENBQU8sWUFBWSxDQUFFLFNBQXlCLEVBQUUsR0FBVzs7WUFDdEUsSUFBSSxhQUFhLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUE7WUFDMUMsSUFBSSxHQUFHLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFBO1lBQy9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUN0RSxDQUFDO0tBQUE7SUFhRCxZQUFhLFVBQVUsRUFBRSxFQUN2QixHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxHQUNuRjtRQUNYLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFBO1FBQ2QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGdDQUFjLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDMUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGdCQUFnQixDQUFBO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFBO1FBRWhCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQTtRQUU3QixZQUFZLENBQUMscURBQVksTUFBTSxDQUFOLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUEsR0FBQSxDQUFDLENBQUE7SUFDdkQsQ0FBQztJQUlNLHNCQUFzQjtRQUMzQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUE7SUFDakQsQ0FBQztJQUVZLFVBQVUsQ0FBRSxPQUFlOztZQUN0QyxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzdCLElBQUksR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUk7Z0JBQ25ELE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO2dCQUN6QixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNiLEtBQUssT0FBTzt3QkFDVixJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSw2QkFBNkIsRUFBQyxDQUFDLENBQUE7d0JBQ2hHLEtBQUssQ0FBQTtvQkFDUCxLQUFLLFFBQVE7d0JBQ1gsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLDhCQUE4QixFQUFDLENBQUMsQ0FBQTt3QkFDakYsS0FBSyxDQUFBO29CQUNQLEtBQUssUUFBUTt3QkFDWCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTt3QkFDckIsS0FBSyxDQUFBO29CQUNQLFNBQVMsS0FBSyxDQUFBO2dCQUNoQixDQUFDO2dCQUNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtZQUNmLENBQUMsQ0FBQyxDQUFBO1lBQ0YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNqQyxNQUFNLENBQUMsR0FBRyxDQUFBO1FBQ1osQ0FBQztLQUFBO0lBRVksVUFBVTs7WUFDckIsSUFBSSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1lBQ2xDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQTtZQUNmLE1BQU0sQ0FBQyxHQUFHLENBQUE7UUFDWixDQUFDO0tBQUE7SUFFWSxnQkFBZ0I7O1lBQzNCLElBQUksRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUE7WUFDdkMsRUFBRSxDQUFDLENBQUMsQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQTtnQkFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDakMsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVELElBQVcsZ0JBQWdCLENBQUUsZ0JBQXlCO1FBQ3BELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxnQkFBZ0IsQ0FBQTtRQUN6QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUE7SUFDZixDQUFDO0lBRUQsSUFBVyxnQkFBZ0I7UUFDekIsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQTtJQUMvQixDQUFDO0lBRU0sU0FBUztRQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUE7SUFDdkIsQ0FBQztJQUVZLGNBQWMsQ0FBRSxNQUFNOztZQUNqQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ25CLE1BQU0sQ0FBQyxFQUFFLENBQUE7WUFDWCxDQUFDO1lBQ0QsSUFBSSxFQUFDLE1BQU0sRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFBO1lBQ3RELE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQTtZQUNkLE1BQU0sQ0FBQyxtQkFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFBO1FBQzFFLENBQUM7S0FBQTtJQUVNLFVBQVUsQ0FBRSxHQUFXLEVBQUUsS0FBc0I7UUFDcEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDZixHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDMUIsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDekQsTUFBTSxDQUFDO3dCQUNMLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSTt3QkFDZCxJQUFJLEVBQUU7NEJBQ0osSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJOzRCQUNiLFdBQVcsRUFBRSxtQkFBbUI7eUJBQ2pDO3FCQUNGLENBQUE7Z0JBQ0gsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVlLGFBQWE7O1lBQzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUE7UUFDdEIsQ0FBQztLQUFBO0lBRWUsUUFBUTs7WUFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUN0QixDQUFDO0tBQUE7SUFFZSxNQUFNOztRQUV0QixDQUFDO0tBQUE7SUFFZSxPQUFPOztZQUNyQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDZCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO1lBQ3JCLENBQUM7UUFDSCxDQUFDO0tBQUE7SUFFZSxVQUFVLENBQUUsVUFBd0I7O1lBQ2xELElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBTSxVQUFVLENBQUE7WUFDM0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUFDLENBQUM7WUFFNUMsSUFBSSxDQUFDO2dCQUNILElBQUksT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxDQUFBO2dCQUN2RSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ3BDLENBQUM7WUFBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1YsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFO3dCQUNqRCxNQUFNLEVBQUUsS0FBSzt3QkFDYixXQUFXLEVBQUUsSUFBSTtxQkFDbEIsQ0FBQyxDQUFBO29CQUNGLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtnQkFDaEIsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxvREFBb0QsQ0FBQyxDQUFBO29CQUNuRixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7Z0JBQ2hCLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRWUsT0FBTyxDQUFFLE9BQWU7O1lBQ3RDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsOEJBQThCLENBQUMsQ0FBQTtZQUFDLENBQUM7WUFDM0UsSUFBSSxLQUFLLEdBQUc7Z0JBQ1YsV0FBVyxFQUFFLE9BQU87Z0JBQ3BCLE1BQU0sRUFBRSxNQUFNO2FBQ2YsQ0FBQTtZQUNELE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQTtZQUVyQyxJQUFJLENBQUMsR0FBRyxHQUFHLE1BQU0sa0JBQWtCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4RCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsTUFBTSxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBRWpFLElBQUksSUFBSSxFQUFFLEtBQUssQ0FBQTtZQUNmLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2QsS0FBSyxHQUFHLE1BQU0sa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzRCxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sa0JBQWtCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtZQUMxRixDQUFDO1lBQ0QsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLE9BQU8sTUFBTSxDQUFDLENBQUE7WUFFcEUsSUFBSSxJQUFJLEdBQUc7Z0JBQ1QsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDO2dCQUNmLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQztnQkFDZixJQUFJLEVBQUUsRUFBRTthQUNULENBQUE7WUFDRCxJQUFJLFNBQVMsR0FBRztnQkFDZCxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssdUJBQXVCO2dCQUNyQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssbUJBQW1CO2dCQUNqQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQzthQUNmLENBQUE7WUFFRCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxDQUFBO1lBQUMsQ0FBQztZQUNyRSxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUE7WUFFL0IsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBRTVGLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ1QsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUM1QixJQUFJLEdBQUcsS0FBSyxDQUFBO29CQUNkLENBQUM7b0JBQ0QsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQTtvQkFDOUIsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUE7Z0JBQ3JDLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtnQkFBQyxDQUFDO1lBQ25DLENBQUM7WUFFRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksV0FBSSxDQUFDO2dCQUNuQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzFCLE9BQU8sRUFBRSxXQUFXO2dCQUNwQixJQUFJLEVBQUUsV0FBVztnQkFDakIsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFO2dCQUN2QixNQUFNLEVBQUUsQ0FBTyxJQUFJLG9EQUFLLE1BQU0sQ0FBTixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUEsR0FBQTthQUN2QyxDQUFDLENBQUE7WUFFRixJQUFJLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQy9CLElBQUksQ0FBQyxnQkFBZ0IsQ0FBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDdEMsTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUE7WUFDMUIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ2YsQ0FBQztLQUFBO0lBRWUsV0FBVzs7WUFDekIsSUFBSSxFQUFDLE1BQU0sRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFBO1lBQ3pELE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJO2dCQUNsQyxJQUFJLEVBQUUsR0FBRyxnREFBZ0QsQ0FBQTtnQkFDekQsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQTtnQkFDMUIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUN0QixJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7b0JBQ2QsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNmLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO29CQUNyRixNQUFNLENBQUM7d0JBQ0wsR0FBRzt3QkFDSCxJQUFJO3dCQUNKLElBQUksRUFBRSxZQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztxQkFDakUsQ0FBQTtnQkFDSCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUE7UUFDSixDQUFDO0tBQUE7SUFFUyxnQkFBZ0IsQ0FBRSxNQUFnQjtRQUMxQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQyxLQUFLLEVBQUMsS0FBSyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFBO1FBQ3pFLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUNyQixHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEQsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDUixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFBO2dCQUNsQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTtnQkFDdkIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUMvQixTQUFTLEdBQUcsSUFBSSxDQUFBO2dCQUNsQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNiLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDcEMsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ2YsQ0FBQztRQUNELE1BQU0sQ0FBQyxTQUFTLENBQUE7SUFDbEIsQ0FBQztJQUVTLGVBQWUsQ0FBRSxPQUFPO1FBQ2hDLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO1FBQ2hFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQTtRQUNwQixHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDOUIsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQTtZQUNoQyxFQUFFLENBQUMsQ0FBQyxVQUFVLEdBQUcsU0FBUyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFBQyxTQUFTLEdBQUcsVUFBVSxDQUFBO1lBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDL0IsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNkLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQTtRQUNwRCxDQUFDO1FBQ0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDekIsQ0FBQztJQUVTLFlBQVksQ0FBRSxHQUFHO1FBQ3pCLElBQUksUUFBUSxHQUFHLGdEQUFnRCxDQUFBO1FBQy9ELEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM3QixJQUFJLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQ2pDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ1osSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO2dCQUM3QyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFhLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ25FLElBQUksR0FBRyxHQUFhLE1BQU0sR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLEdBQUcsT0FBTyxDQUFBO2dCQUMzRCxFQUFFLENBQUMsQ0FBQyxJQUFJLEtBQUssZUFBZSxDQUFDLENBQUMsQ0FBQztvQkFDN0IsSUFBSSxHQUFHLElBQUksQ0FBQTtvQkFDWCxHQUFHLEdBQUcsTUFBTSxDQUFBO2dCQUNkLENBQUM7Z0JBSUQsSUFBSSxNQUFNLEdBQUcsR0FBZ0IsQ0FBQTtnQkFFN0IsTUFBTSxDQUFDO29CQUNMLEdBQUcsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJO29CQUN4RSxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBYyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBYSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDN0UsT0FBTyxFQUFFO3dCQUNQLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDOUMsV0FBVyxFQUFFLHNCQUFzQjtxQkFDcEM7b0JBQ0QsT0FBTyxFQUFFLE9BQWlCO29CQUMxQixRQUFRLEVBQUUsR0FBRztvQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUM7b0JBQ0wsT0FBTyxFQUFFLEdBQUc7b0JBQ1osUUFBUSxFQUFFLE1BQU07b0JBQ2hCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFuVUQsZ0RBbVVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSYW5nZX0gZnJvbSAnYXRvbSdcbmltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7Q29tbWFuZEhpc3Rvcnl9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHtHSENJfSBmcm9tICcuL2doY2knXG5cbnR5cGUgVVBJID0gYW55XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdTdGF0ZSB7XG4gIHVyaT86IHN0cmluZ1xuICBoaXN0b3J5Pzogc3RyaW5nW11cbiAgYXV0b1JlbG9hZFJlcGVhdD86IGJvb2xlYW5cbiAgY29udGVudD86IElDb250ZW50SXRlbVtdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxufVxuXG50eXBlIFNldmVyaXR5ID0gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdyZXBsJyB8IHN0cmluZ1xuXG5leHBvcnQgaW50ZXJmYWNlIElFcnJvckl0ZW0ge1xuICB1cmk/OiBzdHJpbmcsXG4gIHBvc2l0aW9uPzogW251bWJlciwgbnVtYmVyXSxcbiAgbWVzc2FnZTogc3RyaW5nIHwgeyB0ZXh0OiBzdHJpbmcsIGhpZ2hsaWdodGVyOiBzdHJpbmcgfSxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5kZWNsYXJlIGludGVyZmFjZSBJTXlTdHJpbmcgZXh0ZW5kcyBTdHJpbmcge1xuICB0cmltUmlnaHQgKCk6IElNeVN0cmluZ1xufVxuXG5pbnRlcmZhY2UgSVR5cGVSZWNvcmQge1xuICB1cmk6IHN0cmluZ1xuICB0eXBlOiBzdHJpbmdcbiAgc3BhbjogUmFuZ2Vcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpciAodXJpKSB7XG4gICAgcmV0dXJuIFV0aWwuZ2V0Um9vdERpcih1cmkpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldENhYmFsRmlsZSAocm9vdERpcjogQXRvbVR5cGVzLkRpcmVjdG9yeSk6IFByb21pc2U8QXRvbVR5cGVzLkZpbGVbXT4ge1xuICAgIGxldCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHJldHVybiBjb250LmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlQ2FiYWxGaWxlIChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlKTogUHJvbWlzZTxVdGlsLklEb3RDYWJhbD4ge1xuICAgIGxldCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIHJldHVybiBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q29tcG9uZW50IChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLCB1cmk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBsZXQgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICBsZXQgY3dkID0gY2FiYWxGaWxlLmdldFBhcmVudCgpXG4gICAgcmV0dXJuIFV0aWwuZ2V0Q29tcG9uZW50RnJvbUZpbGUoY2FiYWxDb250ZW50cywgY3dkLnJlbGF0aXZpemUodXJpKSlcbiAgfVxuXG4gIHByb3RlY3RlZCBnaGNpOiBHSENJXG4gIHByb3RlY3RlZCBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk6IFVQSVxuICBwcm90ZWN0ZWQgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByb3RlY3RlZCBlcnJvcnM6IElFcnJvckl0ZW1bXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBwcm90ZWN0ZWQgdHlwZXM6IElUeXBlUmVjb3JkW11cblxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZSwge1xuICAgIHVyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gIH06IElWaWV3U3RhdGUpIHtcbiAgICB0aGlzLnVyaSA9IHVyaVxuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy5lcnJvcnMgPSBbXVxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSkpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgdXBkYXRlICgpXG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICEgdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgbGV0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgbGV0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKHR5cGUsIHRleHQpID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IodHlwZSwgdGV4dClcbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe3RleHQ6IGlucC5qb2luKCdcXG4nKSwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCd9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe3RleHQsIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLW91dHB1dC10ZXh0J30pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IHRleHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OiBicmVha1xuICAgICAgfVxuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQgKCkge1xuICAgIGxldCByZXMgPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCAoKSB7XG4gICAgbGV0IHtzdGRlcnJ9ID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgaWYgKCEgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHN0ZGVycikpIHtcbiAgICAgIGxldCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LmdvQmFjaygnJylcbiAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoY29tbWFuZClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc2V0IGF1dG9SZWxvYWRSZXBlYXQgKGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIHRoaXMuZ2hjaS5pbnRlcnJ1cHQoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbXBsZXRpb25zIChwcmVmaXgpIHtcbiAgICBpZiAoIXByZWZpeC50cmltKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cbiAgICBsZXQge3N0ZG91dH0gPSBhd2FpdCB0aGlzLmdoY2kuc2VuZENvbXBsZXRpb25SZXF1ZXN0KClcbiAgICBzdGRvdXQuc2hpZnQoKVxuICAgIHJldHVybiBmaWx0ZXIoc3Rkb3V0LCBwcmVmaXgpLm1hcCgodGV4dCkgPT4gKHt0ZXh0OiB0ZXh0LnNsaWNlKDEsIC0xKX0pKVxuICB9XG5cbiAgcHVibGljIHNob3dUeXBlQXQgKHVyaTogc3RyaW5nLCByYW5nZTogQXRvbVR5cGVzLlJhbmdlKSB7XG4gICAgaWYgKHRoaXMudHlwZXMpIHtcbiAgICAgIGZvciAobGV0IHRyIG9mIHRoaXMudHlwZXMpIHtcbiAgICAgICAgaWYgKHRyICYmIHRyLnVyaSA9PT0gdXJpICYmIHRyLnNwYW4uY29udGFpbnNSYW5nZShyYW5nZSkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmFuZ2U6IHRyLnNwYW4sXG4gICAgICAgICAgICB0ZXh0OiB7XG4gICAgICAgICAgICAgIHRleHQ6IHRyLnR5cGUsXG4gICAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC50eXBlLmhhc2tlbGwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblJlbG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGluaXRpYWxpemUgKHVwaVByb21pc2U6IFByb21pc2U8VVBJPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHsgcmV0dXJuIHRoaXMucnVuUkVQTChudWxsKSB9XG5cbiAgICB0cnkge1xuICAgICAgbGV0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5wYXJhbXMuZ2V0KCdpZGUtaGFza2VsbC1jYWJhbCcsICdidWlsZGVyJylcbiAgICAgIHRoaXMucnVuUkVQTCgoYnVpbGRlciB8fCB7fSkubmFtZSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXCJDYW4ndCBydW4gUkVQTCB3aXRob3V0IGtub3dpbmcgd2hhdCBidWlsZGVyIHRvIHVzZVwiKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBydW5SRVBMIChidWlsZGVyOiBzdHJpbmcpIHtcbiAgICBpZiAoIWJ1aWxkZXIpIHsgYnVpbGRlciA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpIH1cbiAgICBsZXQgc3Vic3QgPSB7XG4gICAgICAnbml4LWJ1aWxkJzogJ2NhYmFsJyxcbiAgICAgICdub25lJzogJ2doY2knLFxuICAgIH1cbiAgICBidWlsZGVyID0gKHN1YnN0W2J1aWxkZXJdIHx8IGJ1aWxkZXIpXG5cbiAgICB0aGlzLmN3ZCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRSb290RGlyKHRoaXMudXJpKVxuICAgIGxldCBbY2FiYWxGaWxlXSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRDYWJhbEZpbGUodGhpcy5jd2QpXG5cbiAgICBsZXQgY29tcCwgY2FiYWxcbiAgICBpZiAoY2FiYWxGaWxlKSB7XG4gICAgICBjYWJhbCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5wYXJzZUNhYmFsRmlsZShjYWJhbEZpbGUpO1xuICAgICAgW2NvbXBdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENvbXBvbmVudChjYWJhbEZpbGUsIHRoaXMuY3dkLnJlbGF0aXZpemUodGhpcy51cmkpKVxuICAgIH1cbiAgICBsZXQgY29tbWFuZFBhdGggPSBhdG9tLmNvbmZpZy5nZXQoYGlkZS1oYXNrZWxsLXJlcGwuJHtidWlsZGVyfVBhdGhgKVxuXG4gICAgbGV0IGFyZ3MgPSB7XG4gICAgICBzdGFjazogWydnaGNpJ10sXG4gICAgICBjYWJhbDogWydyZXBsJ10sXG4gICAgICBnaGNpOiBbXSxcbiAgICB9XG4gICAgbGV0IGV4dHJhQXJncyA9IHtcbiAgICAgIHN0YWNrOiAoeCkgPT4gJy0tZ2hjaS1vcHRpb25zPVwiI3t4fVwiJyxcbiAgICAgIGNhYmFsOiAoeCkgPT4gJy0tZ2hjLW9wdGlvbj0je3h9JyxcbiAgICAgIGdoY2k6ICh4KSA9PiB4LFxuICAgIH1cblxuICAgIGlmICghYXJnc1tidWlsZGVyXSkgeyB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gYnVpbGRlciAje2J1aWxkZXJ9JykgfVxuICAgIGxldCBjb21tYW5kQXJncyA9IGFyZ3NbYnVpbGRlcl1cblxuICAgIGNvbW1hbmRBcmdzLnB1c2goLi4uKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5leHRyYUFyZ3MnKS5tYXAoZXh0cmFBcmdzW2J1aWxkZXJdKSkpXG5cbiAgICBpZiAoY29tcCkge1xuICAgICAgaWYgKGJ1aWxkZXIgPT09ICdzdGFjaycpIHtcbiAgICAgICAgaWYgKGNvbXAuc3RhcnRzV2l0aCgnbGliOicpKSB7XG4gICAgICAgICAgY29tcCA9ICdsaWInXG4gICAgICAgIH1cbiAgICAgICAgY29tcCA9IGAke2NhYmFsLm5hbWV9OiR7Y29tcH1gXG4gICAgICAgIGNvbW1hbmRBcmdzLnB1c2goJy0tbWFpbi1pcycsIGNvbXApXG4gICAgICB9IGVsc2UgeyBjb21tYW5kQXJncy5wdXNoKGNvbXApIH1cbiAgICB9XG5cbiAgICB0aGlzLmdoY2kgPSBuZXcgR0hDSSh7XG4gICAgICBhdG9tUGF0aDogcHJvY2Vzcy5leGVjUGF0aCxcbiAgICAgIGNvbW1hbmQ6IGNvbW1hbmRQYXRoLFxuICAgICAgYXJnczogY29tbWFuZEFyZ3MsXG4gICAgICBjd2Q6IHRoaXMuY3dkLmdldFBhdGgoKSxcbiAgICAgIG9uRXhpdDogYXN5bmMgKGNvZGUpID0+IHRoaXMuZGVzdHJveSgpLFxuICAgIH0pXG5cbiAgICBsZXQgaW5pdHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuICAgIHRoaXMucHJvbXB0ID0gaW5pdHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIgKGluaXRyZXMuc3RkZXJyKVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEFsbFR5cGVzICgpOiBQcm9taXNlPElUeXBlUmVjb3JkW10+IHtcbiAgICBsZXQge3N0ZG91dH0gPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhbJzphbGwtdHlwZXMnXSlcbiAgICByZXR1cm4gdGhpcy50eXBlcyA9IHN0ZG91dC5tYXAoKGxpbmUpID0+IHtcbiAgICAgIGxldCByeCA9IC9eKC4qKTpcXCgoXFxkKyksKFxcZCspXFwpLVxcKChcXGQrKSwoXFxkKylcXCk6XFxzKiguKikkL1xuICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaChyeClcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBsZXQgbSA9IG1hdGNoLnNsaWNlKDEpXG4gICAgICAgIGxldCB1cmkgPSBtWzBdXG4gICAgICAgIGxldCB0eXBlID0gbVs1XVxuICAgICAgICBsZXQgW3Jvd3N0YXJ0LCBjb2xzdGFydCwgcm93ZW5kLCBjb2xlbmRdID0gbS5zbGljZSgxKS5tYXAoKGkpID0+IHBhcnNlSW50KGksIDEwKSAtIDEpXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgc3BhbjogUmFuZ2UuZnJvbU9iamVjdChbW3Jvd3N0YXJ0LCBjb2xzdGFydF0sIFtyb3dlbmQsIGNvbGVuZF1dKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwcm90ZWN0ZWQgZXJyb3JzRnJvbVN0ZGVyciAoc3RkZXJyOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuZmlsdGVyKCh7X3RpbWV9KSA9PiBEYXRlLm5vdygpIC0gX3RpbWUgPCAxMDAwMClcbiAgICBsZXQgaGFzRXJyb3JzID0gZmFsc2VcbiAgICBmb3IgKGxldCBlcnIgb2Ygc3RkZXJyLmpvaW4oJ1xcbicpLnNwbGl0KC9cXG4oPz1cXFMpLykpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgbGV0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICB0aGlzLmVycm9ycy5wdXNoKGVycm9yKVxuICAgICAgICBpZiAoZXJyb3Iuc2V2ZXJpdHkgPT09ICdlcnJvcicpIHtcbiAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMudXBpKSB7XG4gICAgICB0aGlzLnVwaS5tZXNzYWdlcy5zZXQodGhpcy5lcnJvcnMpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9XG4gICAgcmV0dXJuIGhhc0Vycm9yc1xuICB9XG5cbiAgcHJvdGVjdGVkIHVuaW5kZW50TWVzc2FnZSAobWVzc2FnZSk6IHN0cmluZyB7XG4gICAgbGV0IGxpbmVzID0gbWVzc2FnZS5zcGxpdCgnXFxuJykuZmlsdGVyKCh4KSA9PiAheC5tYXRjaCgvXlxccyokLykpXG4gICAgbGV0IG1pbkluZGVudCA9IG51bGxcbiAgICBmb3IgKGxldCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pXG4gICAgICBsZXQgbGluZUluZGVudCA9IG1hdGNoWzBdLmxlbmd0aFxuICAgICAgaWYgKGxpbmVJbmRlbnQgPCBtaW5JbmRlbnQgfHwgIW1pbkluZGVudCkgeyBtaW5JbmRlbnQgPSBsaW5lSW5kZW50IH1cbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihtaW5JbmRlbnQsIGxpbmVzKVxuICAgIGlmIChtaW5JbmRlbnQpIHtcbiAgICAgIGxpbmVzID0gbGluZXMubWFwKChsaW5lKSA9PiBsaW5lLnNsaWNlKG1pbkluZGVudCkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBhcnNlTWVzc2FnZSAocmF3KTogSUVycm9ySXRlbSB7XG4gICAgbGV0IG1hdGNoTG9jID0gL14oLispOihcXGQrKTooXFxkKyk6KD86IChcXHcrKTopP1xccyooXFxbW15cXF1dK1xcXSk/L1xuICAgIGlmIChyYXcgJiYgcmF3LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIGxldCBtYXRjaGVkID0gcmF3Lm1hdGNoKG1hdGNoTG9jKVxuICAgICAgaWYgKG1hdGNoZWQpIHtcbiAgICAgICAgbGV0IG1zZyA9IHJhdy5zcGxpdCgnXFxuJykuc2xpY2UoMSkuam9pbignXFxuJylcbiAgICAgICAgbGV0IFtmaWxlLCBsaW5lLCBjb2wsIHJhd1R5cCwgY29udGV4dF06IFN0cmluZ1tdID0gbWF0Y2hlZC5zbGljZSgxKVxuICAgICAgICBsZXQgdHlwOiBTZXZlcml0eSA9IHJhd1R5cCA/IHJhd1R5cC50b0xvd2VyQ2FzZSgpIDogJ2Vycm9yJ1xuICAgICAgICBpZiAoZmlsZSA9PT0gJzxpbnRlcmFjdGl2ZT4nKSB7XG4gICAgICAgICAgZmlsZSA9IG51bGxcbiAgICAgICAgICB0eXAgPSAncmVwbCdcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5PVEU6IHRoaXMgaXMgZG9uZSBiZWNhdXNlIHR5cGVzY3JpcHQgaW5zaXN0cyBzdHJpbmdzIGRvbnQgaGF2ZVxuICAgICAgICAvLyB0cmltUmlnaHQoKSBtZXRob2RcbiAgICAgICAgbGV0IG1zZ2FueSA9IG1zZyBhcyBJTXlTdHJpbmdcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVyaTogZmlsZSA/IHRoaXMuY3dkLmdldEZpbGUodGhpcy5jd2QucmVsYXRpdml6ZShmaWxlKSkuZ2V0UGF0aCgpIDogbnVsbCxcbiAgICAgICAgICBwb3NpdGlvbjogW3BhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLCBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxXSxcbiAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnVuaW5kZW50TWVzc2FnZShtc2dhbnkudHJpbVJpZ2h0KCkpLFxuICAgICAgICAgICAgaGlnaGxpZ2h0ZXI6ICdoaW50Lm1lc3NhZ2UuaGFza2VsbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb250ZXh0OiBjb250ZXh0IGFzIHN0cmluZyxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=