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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBNkIzQjtJQUNTLE1BQU0sQ0FBTyxVQUFVLENBQUUsR0FBRzs7WUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDN0IsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFPLFlBQVksQ0FBRSxPQUE0Qjs7WUFDNUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtnQkFDdEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2YsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7Z0JBQ25CLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFBO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFxQixDQUFBO1FBQ2pGLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxjQUFjLENBQUUsU0FBeUI7O1lBQzNELE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQzFDLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxZQUFZLENBQUUsU0FBeUIsRUFBRSxHQUFXOztZQUN0RSxNQUFNLGFBQWEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtZQUM1QyxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBQ3RFLENBQUM7S0FBQTtJQVlELFlBQWEsVUFBVSxFQUFFLEVBQ3ZCLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLEdBQ25GO1FBQ1gsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQzFDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxnQkFBZ0IsQ0FBQTtRQUN6QyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQTtRQUVoQixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUE7UUFFN0IsWUFBWSxDQUFDLHFEQUFZLE1BQU0sQ0FBTixJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFBLEdBQUEsQ0FBQyxDQUFBO0lBQ3ZELENBQUM7SUFJTSxzQkFBc0I7UUFDM0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFBO0lBQ2pELENBQUM7SUFFWSxVQUFVLENBQUUsT0FBZTs7WUFDdEMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUMvQixNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVE7Z0JBQ25ELE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUN0QixLQUFLLE9BQU87d0JBQ1YsUUFBUSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQzs0QkFDbEMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsNkJBQTZCO3lCQUNuRSxDQUFDLENBQUE7d0JBQ0YsS0FBSyxDQUFBO29CQUNQLEtBQUssUUFBUTt3QkFDWCxRQUFRLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDOzRCQUNsQyxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSw4QkFBOEI7eUJBQ25FLENBQUMsQ0FBQTt3QkFDRixLQUFLLENBQUE7b0JBQ1AsS0FBSyxRQUFRO3dCQUNYLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTt3QkFDaEMsS0FBSyxDQUFBO29CQUNQLFNBQVMsS0FBSyxDQUFBO2dCQUNoQixDQUFDO2dCQUNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtZQUNmLENBQUMsQ0FBQyxDQUFBO1lBQ0YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNqQyxNQUFNLENBQUMsR0FBRyxDQUFBO1FBQ1osQ0FBQztLQUFBO0lBRVksVUFBVTs7WUFDckIsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1lBQ3BDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQTtZQUNmLE1BQU0sQ0FBQyxHQUFHLENBQUE7UUFDWixDQUFDO0tBQUE7SUFFWSxnQkFBZ0I7O1lBQzNCLE1BQU0sRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtZQUN4QyxFQUFFLENBQUMsQ0FBQyxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFBO2dCQUN2QyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUNqQyxDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRUQsSUFBVyxnQkFBZ0IsQ0FBRSxnQkFBeUI7UUFDcEQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGdCQUFnQixDQUFBO1FBQ3pDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtJQUNmLENBQUM7SUFFRCxJQUFXLGdCQUFnQjtRQUN6QixNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFBO0lBQy9CLENBQUM7SUFFTSxTQUFTO1FBQ2QsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQTtJQUN2QixDQUFDO0lBRVksY0FBYyxDQUFFLE1BQU07O1lBQ2pDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkIsTUFBTSxDQUFDLEVBQUUsQ0FBQTtZQUNYLENBQUM7WUFDRCxNQUFNLEVBQUMsTUFBTSxFQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUE7WUFDeEQsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFBO1lBQ2QsTUFBTSxDQUFDLG1CQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUE7UUFDMUUsQ0FBQztLQUFBO0lBRWUsYUFBYTs7WUFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUN0QixDQUFDO0tBQUE7SUFFZSxRQUFROztZQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ3RCLENBQUM7S0FBQTtJQUVlLE1BQU07O1FBRXRCLENBQUM7S0FBQTtJQUVlLE9BQU87O1lBQ3JCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7WUFDckIsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVlLFVBQVUsQ0FBRSxVQUF3Qjs7WUFDbEQsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLFVBQVUsQ0FBQTtZQUMzQixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQUMsQ0FBQztZQUU1QyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsU0FBUyxDQUFDLENBQUE7Z0JBQ3pFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDcEMsQ0FBQztZQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ2YsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUU7d0JBQ2pELE1BQU0sRUFBRSxLQUFLO3dCQUNiLFdBQVcsRUFBRSxJQUFJO3FCQUNsQixDQUFDLENBQUE7b0JBQ0YsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO2dCQUNoQixDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLG9EQUFvRCxDQUFDLENBQUE7b0JBQ25GLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtnQkFDaEIsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0tBQUE7SUFFZSxPQUFPLENBQUUsU0FBd0I7O1lBQy9DLElBQUksT0FBTyxHQUFHLFNBQVMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO1lBQzFFLE1BQU0sS0FBSyxHQUFHO2dCQUNaLFdBQVcsRUFBRSxPQUFPO2dCQUNwQixNQUFNLEVBQUUsTUFBTTthQUNmLENBQUE7WUFDRCxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUE7WUFFckMsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLE1BQU0sa0JBQWtCLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUVuRSxJQUFJLElBQUksRUFBRSxLQUFLLENBQUE7WUFDZixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNkLEtBQUssR0FBRyxNQUFNLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0QsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7WUFDMUYsQ0FBQztZQUNELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixPQUFPLE1BQU0sQ0FBQyxDQUFBO1lBRXRFLE1BQU0sSUFBSSxHQUFHO2dCQUNYLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQztnQkFDZixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUM7Z0JBQ2YsSUFBSSxFQUFFLEVBQUU7YUFDVCxDQUFBO1lBQ0QsTUFBTSxTQUFTLEdBQUc7Z0JBQ2hCLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyx1QkFBdUI7Z0JBQ3JDLEtBQUssRUFBRSxDQUFDLENBQUMsS0FBSyxtQkFBbUI7Z0JBQ2pDLElBQUksRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQ2YsQ0FBQTtZQUVELEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFBQyxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixDQUFDLENBQUE7WUFBQyxDQUFDO1lBQ3JFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUVqQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFFNUYsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDVCxFQUFFLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDeEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzVCLElBQUksR0FBRyxLQUFLLENBQUE7b0JBQ2QsQ0FBQztvQkFDRCxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFBO29CQUM5QixXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQTtnQkFDckMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO2dCQUFDLENBQUM7WUFDbkMsQ0FBQztZQUVELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUM7Z0JBQ25CLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTtnQkFDMUIsT0FBTyxFQUFFLFdBQVc7Z0JBQ3BCLElBQUksRUFBRSxXQUFXO2dCQUNqQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7Z0JBQ3ZCLE1BQU0sRUFBRSxDQUFPLElBQUksb0RBQUssTUFBTSxDQUFOLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQSxHQUFBO2FBQ3ZDLENBQUMsQ0FBQTtZQUVGLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQTtZQUMzQyxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFDL0IsSUFBSSxDQUFDLGdCQUFnQixDQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUN0QyxNQUFNLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQTtZQUMxQixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUE7UUFDZixDQUFDO0tBQUE7SUFFUyxnQkFBZ0IsQ0FBRSxNQUFnQjtRQUMxQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQyxLQUFLLEVBQUMsS0FBSyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFBO1FBQ3pFLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUNyQixHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEQsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDUixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFBO2dCQUNwQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNWLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO29CQUN2QixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQy9CLFNBQVMsR0FBRyxJQUFJLENBQUE7b0JBQ2xCLENBQUM7Z0JBQ0gsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBQ0QsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDYixJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQTtRQUNmLENBQUM7UUFDRCxNQUFNLENBQUMsU0FBUyxDQUFBO0lBQ2xCLENBQUM7SUFFUyxlQUFlLENBQUUsT0FBTztRQUNoQyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUNoRSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUE7UUFDcEIsR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN6QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ2hDLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUE7WUFDbEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQTtZQUFDLENBQUM7UUFDdEUsQ0FBQztRQUNELE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBQy9CLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDZCxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUE7UUFDcEQsQ0FBQztRQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3pCLENBQUM7SUFFUyxZQUFZLENBQUUsR0FBRztRQUN6QixNQUFNLFFBQVEsR0FBRyxnREFBZ0QsQ0FBQTtRQUNqRSxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0IsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQTtZQUNuQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNaLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtnQkFDL0MsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBOEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDdkYsSUFBSSxHQUFHLEdBQWEsTUFBTSxHQUFHLE1BQU0sQ0FBQyxXQUFXLEVBQUUsR0FBRyxPQUFPLENBQUE7Z0JBQzNELElBQUksSUFBd0IsQ0FBQTtnQkFDNUIsRUFBRSxDQUFDLENBQUMsS0FBSyxLQUFLLGVBQWUsQ0FBQyxDQUFDLENBQUM7b0JBQzlCLElBQUksR0FBRyxTQUFTLENBQUE7b0JBQ2hCLEdBQUcsR0FBRyxNQUFNLENBQUE7Z0JBQ2QsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixJQUFJLEdBQUcsS0FBSyxDQUFBO2dCQUNkLENBQUM7Z0JBRUQsTUFBTSxDQUFDO29CQUNMLEdBQUcsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxTQUFTO29CQUM3RSxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBYyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBYSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDN0UsT0FBTyxFQUFFO3dCQUNQLElBQUksRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQzt3QkFDM0MsV0FBVyxFQUFFLHNCQUFzQjtxQkFDcEM7b0JBQ0QsT0FBTztvQkFDUCxRQUFRLEVBQUUsR0FBRztvQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUM7b0JBQ0wsT0FBTyxFQUFFLEdBQUc7b0JBQ1osUUFBUSxFQUFFLE1BQU07b0JBQ2hCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFuU0QsZ0RBbVNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtSYW5nZX0gZnJvbSAnYXRvbSdcbmltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7Q29tbWFuZEhpc3Rvcnl9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHtHSENJfSBmcm9tICcuL2doY2knXG5cbnR5cGUgVVBJID0gYW55XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdTdGF0ZSB7XG4gIHVyaT86IHN0cmluZ1xuICBoaXN0b3J5Pzogc3RyaW5nW11cbiAgYXV0b1JlbG9hZFJlcGVhdD86IGJvb2xlYW5cbiAgY29udGVudD86IElDb250ZW50SXRlbVtdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRlbnRJdGVtIHtcbiAgdGV4dDogc3RyaW5nXG4gIGNsczogc3RyaW5nXG4gIGhsPzogYm9vbGVhblxuICBobGNhY2hlPzogc3RyaW5nXG59XG5cbnR5cGUgU2V2ZXJpdHkgPSAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ3JlcGwnIHwgc3RyaW5nXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSB7XG4gIHVyaT86IHN0cmluZyxcbiAgcG9zaXRpb24/OiBbbnVtYmVyLCBudW1iZXJdLFxuICBtZXNzYWdlOiBzdHJpbmcgfCB7IHRleHQ6IHN0cmluZywgaGlnaGxpZ2h0ZXI6IHN0cmluZyB9LFxuICBjb250ZXh0Pzogc3RyaW5nLFxuICBzZXZlcml0eTogU2V2ZXJpdHksXG4gIF90aW1lOiBudW1iZXIsXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFJvb3REaXIgKHVyaSkge1xuICAgIHJldHVybiBVdGlsLmdldFJvb3REaXIodXJpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRDYWJhbEZpbGUgKHJvb3REaXI6IEF0b21UeXBlcy5EaXJlY3RvcnkpOiBQcm9taXNlPEF0b21UeXBlcy5GaWxlW10+IHtcbiAgICBjb25zdCBjb250ID0gYXdhaXQgbmV3IFByb21pc2U8QXJyYXk8QXRvbVR5cGVzLkRpcmVjdG9yeSB8IEF0b21UeXBlcy5GaWxlPj4oXG4gICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiByb290RGlyLmdldEVudHJpZXMoKGVycm9yLCBjb250ZW50cykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICByZWplY3QoZXJyb3IpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShjb250ZW50cylcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHJldHVybiBjb250LmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKSBhcyBBdG9tVHlwZXMuRmlsZVtdXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlQ2FiYWxGaWxlIChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlKTogUHJvbWlzZTxVdGlsLklEb3RDYWJhbCB8IG51bGw+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIHJldHVybiBVdGlsLnBhcnNlRG90Q2FiYWwoY2FiYWxDb250ZW50cylcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q29tcG9uZW50IChjYWJhbEZpbGU6IEF0b21UeXBlcy5GaWxlLCB1cmk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBjYWJhbENvbnRlbnRzID0gYXdhaXQgY2FiYWxGaWxlLnJlYWQoKVxuICAgIGNvbnN0IGN3ZCA9IGNhYmFsRmlsZS5nZXRQYXJlbnQoKVxuICAgIHJldHVybiBVdGlsLmdldENvbXBvbmVudEZyb21GaWxlKGNhYmFsQ29udGVudHMsIGN3ZC5yZWxhdGl2aXplKHVyaSkpXG4gIH1cblxuICBwcm90ZWN0ZWQgZ2hjaTogR0hDSVxuICBwcm90ZWN0ZWQgY3dkOiBBdG9tVHlwZXMuRGlyZWN0b3J5XG4gIHByb3RlY3RlZCBwcm9tcHQ6IHN0cmluZ1xuICBwcm90ZWN0ZWQgdXBpOiBVUElcbiAgcHJvdGVjdGVkIG1lc3NhZ2VzOiBJQ29udGVudEl0ZW1bXVxuICBwcm90ZWN0ZWQgZXJyb3JzOiBJRXJyb3JJdGVtW11cbiAgcHJvdGVjdGVkIF9hdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByb3RlY3RlZCBoaXN0b3J5OiBDb21tYW5kSGlzdG9yeVxuICBwcm90ZWN0ZWQgdXJpOiBzdHJpbmdcblxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZSwge1xuICAgIHVyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gIH06IElWaWV3U3RhdGUpIHtcbiAgICB0aGlzLnVyaSA9IHVyaSB8fCAnJ1xuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy5lcnJvcnMgPSBbXVxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSkpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgdXBkYXRlICgpXG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICEgdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgY29uc3QgaW5wID0gY29tbWFuZC5zcGxpdCgnXFxuJylcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhpbnAsIChsaW5lSW5mbykgPT4ge1xuICAgICAgc3dpdGNoIChsaW5lSW5mby50eXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0ZGluJzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBpbnAuam9pbignXFxuJyksIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICBsaW5lSW5mby5saW5lICYmIHRoaXMubWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0ZXh0OiBsaW5lSW5mby5saW5lLCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCcsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdwcm9tcHQnOlxuICAgICAgICAgIHRoaXMucHJvbXB0ID0gbGluZUluZm8ucHJvbXB0WzFdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDogYnJlYWtcbiAgICAgIH1cbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkICgpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICB0aGlzLm9uUmVsb2FkKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2hjaVJlbG9hZFJlcGVhdCAoKSB7XG4gICAgY29uc3Qge3N0ZGVycn0gPSBhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKVxuICAgIGlmICghIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihzdGRlcnIpKSB7XG4gICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5oaXN0b3J5LmdvQmFjaygnJylcbiAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoY29tbWFuZClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgc2V0IGF1dG9SZWxvYWRSZXBlYXQgKGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXQgYXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXRcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIHRoaXMuZ2hjaS5pbnRlcnJ1cHQoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdldENvbXBsZXRpb25zIChwcmVmaXgpIHtcbiAgICBpZiAoIXByZWZpeC50cmltKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cbiAgICBjb25zdCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIHN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihzdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe3RleHQ6IHRleHQuc2xpY2UoMSwgLTEpfSkpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvblJlbG9hZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMub25Mb2FkKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGluaXRpYWxpemUgKHVwaVByb21pc2U6IFByb21pc2U8VVBJPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHsgcmV0dXJuIHRoaXMucnVuUkVQTChudWxsKSB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYnVpbGRlciA9IGF3YWl0IHRoaXMudXBpLnBhcmFtcy5nZXQoJ2lkZS1oYXNrZWxsLWNhYmFsJywgJ2J1aWxkZXInKVxuICAgICAgdGhpcy5ydW5SRVBMKChidWlsZGVyIHx8IHt9KS5uYW1lKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZXJyb3IudG9TdHJpbmcoKSwge1xuICAgICAgICAgIGRldGFpbDogZXJyb3IsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhcIkNhbid0IHJ1biBSRVBMIHdpdGhvdXQga25vd2luZyB3aGF0IGJ1aWxkZXIgdG8gdXNlXCIpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIHJ1blJFUEwgKGluYnVpbGRlcjogc3RyaW5nIHwgbnVsbCkge1xuICAgIGxldCBidWlsZGVyID0gaW5idWlsZGVyIHx8IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpXG4gICAgY29uc3Qgc3Vic3QgPSB7XG4gICAgICAnbml4LWJ1aWxkJzogJ2NhYmFsJyxcbiAgICAgICdub25lJzogJ2doY2knLFxuICAgIH1cbiAgICBidWlsZGVyID0gKHN1YnN0W2J1aWxkZXJdIHx8IGJ1aWxkZXIpXG5cbiAgICB0aGlzLmN3ZCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRSb290RGlyKHRoaXMudXJpKVxuICAgIGNvbnN0IFtjYWJhbEZpbGVdID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmdldENhYmFsRmlsZSh0aGlzLmN3ZClcblxuICAgIGxldCBjb21wLCBjYWJhbFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGNhYmFsID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLnBhcnNlQ2FiYWxGaWxlKGNhYmFsRmlsZSk7XG4gICAgICBbY29tcF0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuZ2V0Q29tcG9uZW50KGNhYmFsRmlsZSwgdGhpcy5jd2QucmVsYXRpdml6ZSh0aGlzLnVyaSkpXG4gICAgfVxuICAgIGNvbnN0IGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KGBpZGUtaGFza2VsbC1yZXBsLiR7YnVpbGRlcn1QYXRoYClcblxuICAgIGNvbnN0IGFyZ3MgPSB7XG4gICAgICBzdGFjazogWydnaGNpJ10sXG4gICAgICBjYWJhbDogWydyZXBsJ10sXG4gICAgICBnaGNpOiBbXSxcbiAgICB9XG4gICAgY29uc3QgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4KSA9PiAnLS1naGNpLW9wdGlvbnM9XCIje3h9XCInLFxuICAgICAgY2FiYWw6ICh4KSA9PiAnLS1naGMtb3B0aW9uPSN7eH0nLFxuICAgICAgZ2hjaTogKHgpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcignVW5rbm93biBidWlsZGVyICN7YnVpbGRlcn0nKSB9XG4gICAgY29uc3QgY29tbWFuZEFyZ3MgPSBhcmdzW2J1aWxkZXJdXG5cbiAgICBjb21tYW5kQXJncy5wdXNoKC4uLihhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJykubWFwKGV4dHJhQXJnc1tidWlsZGVyXSkpKVxuXG4gICAgaWYgKGNvbXApIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGlmIChjb21wLnN0YXJ0c1dpdGgoJ2xpYjonKSkge1xuICAgICAgICAgIGNvbXAgPSAnbGliJ1xuICAgICAgICB9XG4gICAgICAgIGNvbXAgPSBgJHtjYWJhbC5uYW1lfToke2NvbXB9YFxuICAgICAgICBjb21tYW5kQXJncy5wdXNoKCctLW1haW4taXMnLCBjb21wKVxuICAgICAgfSBlbHNlIHsgY29tbWFuZEFyZ3MucHVzaChjb21wKSB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jIChjb2RlKSA9PiB0aGlzLmRlc3Ryb3koKSxcbiAgICB9KVxuXG4gICAgY29uc3QgaW5pdHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuICAgIHRoaXMucHJvbXB0ID0gaW5pdHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIgKGluaXRyZXMuc3RkZXJyKVxuICAgIGF3YWl0IHRoaXMub25Jbml0aWFsTG9hZCgpXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGVycm9yc0Zyb21TdGRlcnIgKHN0ZGVycjogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcigoe190aW1lfSkgPT4gRGF0ZS5ub3coKSAtIF90aW1lIDwgMTAwMDApXG4gICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChjb25zdCBlcnIgb2Ygc3RkZXJyLmpvaW4oJ1xcbicpLnNwbGl0KC9cXG4oPz1cXFMpLykpIHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB0aGlzLnBhcnNlTWVzc2FnZShlcnIpXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHRoaXMuZXJyb3JzLnB1c2goZXJyb3IpXG4gICAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgICBoYXNFcnJvcnMgPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgdGhpcy51cGkubWVzc2FnZXMuc2V0KHRoaXMuZXJyb3JzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UgKG1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQgPSBudWxsXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqLylcbiAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgIGlmICghbWluSW5kZW50IHx8IGxpbmVJbmRlbnQgPCBtaW5JbmRlbnQpIHsgbWluSW5kZW50ID0gbGluZUluZGVudCB9XG4gICAgfVxuICAgIGNvbnNvbGUuZXJyb3IobWluSW5kZW50LCBsaW5lcylcbiAgICBpZiAobWluSW5kZW50KSB7XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaW5JbmRlbnQpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByb3RlY3RlZCBwYXJzZU1lc3NhZ2UgKHJhdyk6IElFcnJvckl0ZW0gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IG1hdGNoTG9jID0gL14oLispOihcXGQrKTooXFxkKyk6KD86IChcXHcrKTopP1xccyooXFxbW15cXF1dK1xcXSk/L1xuICAgIGlmIChyYXcgJiYgcmF3LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIGNvbnN0IG1hdGNoZWQgPSByYXcubWF0Y2gobWF0Y2hMb2MpXG4gICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICBjb25zdCBtc2cgPSByYXcuc3BsaXQoJ1xcbicpLnNsaWNlKDEpLmpvaW4oJ1xcbicpXG4gICAgICAgIGNvbnN0IFtmaWxlYywgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHRdOiBBcnJheTxzdHJpbmcgfCB1bmRlZmluZWQ+ID0gbWF0Y2hlZC5zbGljZSgxKVxuICAgICAgICBsZXQgdHlwOiBTZXZlcml0eSA9IHJhd1R5cCA/IHJhd1R5cC50b0xvd2VyQ2FzZSgpIDogJ2Vycm9yJ1xuICAgICAgICBsZXQgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgIGlmIChmaWxlYyA9PT0gJzxpbnRlcmFjdGl2ZT4nKSB7XG4gICAgICAgICAgZmlsZSA9IHVuZGVmaW5lZFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpbGUgPSBmaWxlY1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwb3NpdGlvbjogW3BhcnNlSW50KGxpbmUgYXMgc3RyaW5nLCAxMCkgLSAxLCBwYXJzZUludChjb2wgYXMgc3RyaW5nLCAxMCkgLSAxXSxcbiAgICAgICAgICBtZXNzYWdlOiB7XG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnVuaW5kZW50TWVzc2FnZShtc2cudHJpbVJpZ2h0KCkpLFxuICAgICAgICAgICAgaGlnaGxpZ2h0ZXI6ICdoaW50Lm1lc3NhZ2UuaGFza2VsbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgIHNldmVyaXR5OiB0eXAsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbWVzc2FnZTogcmF3LFxuICAgICAgICAgIHNldmVyaXR5OiAncmVwbCcsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==