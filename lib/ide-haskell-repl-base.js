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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBMkIzQjtJQUNTLE1BQU0sQ0FBTyxVQUFVLENBQUUsR0FBVzs7WUFDekMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDN0IsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFPLFlBQVksQ0FBRSxPQUE0Qjs7WUFDNUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FDNUIsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtnQkFDdEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7Z0JBQ2YsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUE7Z0JBQ25CLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFBO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQ3BCLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFxQixDQUFBO1FBQ2pGLENBQUM7S0FBQTtJQUVNLE1BQU0sQ0FBTyxjQUFjLENBQUUsU0FBeUI7O1lBQzNELE1BQU0sYUFBYSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFBO1lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQzFDLENB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LEdBQWEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdFLE9BQU8sRUFBRTt3QkFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBRSxHQUF1QyxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUNoRixXQUFXLEVBQUUsc0JBQXNCO3FCQUNwQztvQkFDRCxPQUFPO29CQUNQLFFBQVEsRUFBRSxHQUFHO29CQUNiLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQztvQkFDTCxPQUFPLEVBQUUsR0FBRztvQkFDWixRQUFRLEVBQUUsTUFBTTtvQkFDaEIsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7aUJBQ2xCLENBQUE7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7Q0FDRjtBQWxURCxnREFrVEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JhbmdlfSBmcm9tICdhdG9tJ1xuaW1wb3J0ICogYXMgVXRpbCBmcm9tICdhdG9tLWhhc2tlbGwtdXRpbHMnXG5pbXBvcnQge2ZpbHRlcn0gZnJvbSAnZnV6emFsZHJpbidcblxuaW1wb3J0IHtDb21tYW5kSGlzdG9yeX0gZnJvbSAnLi9jb21tYW5kLWhpc3RvcnknXG5pbXBvcnQge0dIQ0l9IGZyb20gJy4vZ2hjaSdcblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1N0YXRlIHtcbiAgdXJpPzogc3RyaW5nXG4gIGhpc3Rvcnk/OiBzdHJpbmdbXVxuICBhdXRvUmVsb2FkUmVwZWF0PzogYm9vbGVhblxuICBjb250ZW50PzogSUNvbnRlbnRJdGVtW11cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudEl0ZW0ge1xuICB0ZXh0OiBzdHJpbmdcbiAgY2xzOiBzdHJpbmdcbiAgaGw/OiBib29sZWFuXG4gIGhsY2FjaGU/OiBzdHJpbmdcbn1cblxudHlwZSBTZXZlcml0eSA9ICdlcnJvcicgfCAnd2FybmluZycgfCAncmVwbCcgfCBzdHJpbmdcblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIHtcbiAgdXJpPzogc3RyaW5nLFxuICBwb3NpdGlvbj86IFtudW1iZXIsIG51bWJlcl0sXG4gIG1lc3NhZ2U6IHN0cmluZyB8IHsgdGV4dDogc3RyaW5nLCBoaWdobGlnaHRlcjogc3RyaW5nIH0sXG4gIGNvbnRleHQ/OiBzdHJpbmcsXG4gIHNldmVyaXR5OiBTZXZlcml0eSxcbiAgX3RpbWU6IG51bWJlcixcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Um9vdERpciAodXJpOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gVXRpbC5nZXRSb290RGlyKHVyaSlcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0Q2FiYWxGaWxlIChyb290RGlyOiBBdG9tVHlwZXMuRGlyZWN0b3J5KTogUHJvbWlzZTxBdG9tVHlwZXMuRmlsZVtdPiB7XG4gICAgY29uc3QgY29udCA9IGF3YWl0IG5ldyBQcm9taXNlPEFycmF5PEF0b21UeXBlcy5EaXJlY3RvcnkgfCBBdG9tVHlwZXMuRmlsZT4+KFxuICAgICAgKHJlc29sdmUsIHJlamVjdCkgPT4gcm9vdERpci5nZXRFbnRyaWVzKChlcnJvciwgY29udGVudHMpID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoY29udGVudHMpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICByZXR1cm4gY29udC5maWx0ZXIoKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSkgYXMgQXRvbVR5cGVzLkZpbGVbXVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBwYXJzZUNhYmFsRmlsZSAoY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSk6IFByb21pc2U8VXRpbC5JRG90Q2FiYWwgfCBudWxsPiB7XG4gICAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICByZXR1cm4gVXRpbC5wYXJzZURvdENhYmFsKGNhYmFsQ29udGVudHMpXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldENvbXBvbmVudCAoY2FiYWxGaWxlOiBBdG9tVHlwZXMuRmlsZSwgdXJpOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgY2FiYWxDb250ZW50cyA9IGF3YWl0IGNhYmFsRmlsZS5yZWFkKClcbiAgICBjb25zdCBjd2QgPSBjYWJhbEZpbGUuZ2V0UGFyZW50KClcbiAgICByZXR1cm4gVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZShjYWJhbENvbnRlbnRzLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBhc3luYyBjb21wb25lbnRGcm9tVVJJICh1cmk6IHN0cmluZykge1xuICAgIGNvbnN0IGN3ZCA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRSb290RGlyKHVyaSlcbiAgICBjb25zdCBbY2FiYWxGaWxlXSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRDYWJhbEZpbGUoY3dkKVxuXG4gICAgbGV0IGNvbXAsIGNhYmFsXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgY2FiYWwgPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UucGFyc2VDYWJhbEZpbGUoY2FiYWxGaWxlKTtcbiAgICAgIFtjb21wXSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5nZXRDb21wb25lbnQoY2FiYWxGaWxlLCBjd2QucmVsYXRpdml6ZSh1cmkpKVxuICAgIH1cbiAgICByZXR1cm4ge2N3ZCwgY29tcCwgY2FiYWx9XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2hjaT86IEdIQ0lcbiAgcHJvdGVjdGVkIGN3ZD86IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk/OiBVUEkuSVVQSUluc3RhbmNlXG4gIHByb3RlY3RlZCBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJvdGVjdGVkIGVycm9yczogSUVycm9ySXRlbVtdXG4gIHByb3RlY3RlZCBfYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhblxuICBwcm90ZWN0ZWQgaGlzdG9yeTogQ29tbWFuZEhpc3RvcnlcbiAgcHJvdGVjdGVkIHVyaTogc3RyaW5nXG5cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2U6IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4sIHtcbiAgICB1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICB9OiBJVmlld1N0YXRlKSB7XG4gICAgdGhpcy51cmkgPSB1cmkgfHwgJydcbiAgICB0aGlzLmhpc3RvcnkgPSBuZXcgQ29tbWFuZEhpc3RvcnkoaGlzdG9yeSlcbiAgICB0aGlzLl9hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMuZXJyb3JzID0gW11cbiAgICB0aGlzLnByb21wdCA9ICcnXG5cbiAgICB0aGlzLm1lc3NhZ2VzID0gY29udGVudCB8fCBbXVxuXG4gICAgdGhpcy5pbml0aWFsaXplKHVwaVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgYXN5bmMgdXBkYXRlICgpOiBQcm9taXNlPHZvaWQ+XG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICEgdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCBpbnAgPSBjb21tYW5kLnNwbGl0KCdcXG4nKVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKGxpbmVJbmZvKSA9PiB7XG4gICAgICBzd2l0Y2ggKGxpbmVJbmZvLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RkaW4nOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgIHRleHQ6IGlucC5qb2luKCdcXG4nKSwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCcsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdzdGRvdXQnOlxuICAgICAgICAgIGxpbmVJbmZvLmxpbmUgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHtcbiAgICAgICAgICAgIHRleHQ6IGxpbmVJbmZvLmxpbmUsIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLW91dHB1dC10ZXh0JyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSBsaW5lSW5mby5wcm9tcHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OiBicmVha1xuICAgICAgfVxuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQgKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLnJlbG9hZCgpXG4gICAgdGhpcy5vblJlbG9hZCgpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWRSZXBlYXQgKCkge1xuICAgIGNvbnN0IHtzdGRlcnJ9ID0gYXdhaXQgdGhpcy5naGNpUmVsb2FkKClcbiAgICBpZiAoISB0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKSkge1xuICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5wZWVrKC0xKVxuICAgICAgaWYgKGNvbW1hbmQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdCAoYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhbikge1xuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldCBhdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyAocHJlZml4OiBzdHJpbmcpIHtcbiAgICBpZiAoIXByZWZpeC50cmltKCkpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHN0ZG91dCwgcHJlZml4KS5tYXAoKHRleHQpID0+ICh7dGV4dDogdGV4dC5zbGljZSgxLCAtMSl9KSlcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uUmVsb2FkICgpIHtcbiAgICByZXR1cm4gdGhpcy5vbkxvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCAoKSB7XG4gICAgLy8gbm9vcFxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLmdoY2kpIHtcbiAgICAgIHRoaXMuZ2hjaS5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgaW5pdGlhbGl6ZSAodXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHsgcmV0dXJuIHRoaXMucnVuUkVQTChudWxsKSB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYnVpbGRlciA9IGF3YWl0IHRoaXMudXBpLmdldE90aGVyc0NvbmZpZ1BhcmFtKCdpZGUtaGFza2VsbC1jYWJhbCcsICdidWlsZGVyJykgYXMge25hbWU6IHN0cmluZ31cbiAgICAgIHRoaXMucnVuUkVQTCgoYnVpbGRlciB8fCB7fSkubmFtZSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXCJDYW4ndCBydW4gUkVQTCB3aXRob3V0IGtub3dpbmcgd2hhdCBidWlsZGVyIHRvIHVzZVwiKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBydW5SRVBMIChpbmJ1aWxkZXI6IHN0cmluZyB8IG51bGwpIHtcbiAgICBsZXQgYnVpbGRlciA9IGluYnVpbGRlciB8fCBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKVxuICAgIGNvbnN0IHN1YnN0ID0ge1xuICAgICAgJ25peC1idWlsZCc6ICdjYWJhbCcsXG4gICAgICAnbm9uZSc6ICdnaGNpJyxcbiAgICB9XG4gICAgYnVpbGRlciA9IChzdWJzdFtidWlsZGVyXSB8fCBidWlsZGVyKVxuXG4gICAgY29uc3Qge2N3ZCwgY29tcCwgY2FiYWx9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkodGhpcy51cmkpXG4gICAgdGhpcy5jd2QgPSBjd2RcblxuICAgIGNvbnN0IGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KGBpZGUtaGFza2VsbC1yZXBsLiR7YnVpbGRlcn1QYXRoYClcblxuICAgIGNvbnN0IGFyZ3MgPSB7XG4gICAgICBzdGFjazogWydnaGNpJ10sXG4gICAgICBjYWJhbDogWydyZXBsJ10sXG4gICAgICBnaGNpOiBbXSxcbiAgICB9XG4gICAgY29uc3QgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4OiBzdHJpbmcpID0+IGAtLWdoY2ktb3B0aW9ucz1cIiR7eH1cImAsXG4gICAgICBjYWJhbDogKHg6IHN0cmluZykgPT4gYC0tZ2hjLW9wdGlvbj0ke3h9YCxcbiAgICAgIGdoY2k6ICh4OiBzdHJpbmcpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcihgVW5rbm93biBidWlsZGVyICR7YnVpbGRlcn1gKSB9XG4gICAgY29uc3QgY29tbWFuZEFyZ3MgPSBhcmdzW2J1aWxkZXJdXG5cbiAgICBjb21tYW5kQXJncy5wdXNoKC4uLihhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJykubWFwKGV4dHJhQXJnc1tidWlsZGVyXSkpKVxuXG4gICAgaWYgKGNvbXAgJiYgY2FiYWwpIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGNvbnN0IGNvbXBjID1cbiAgICAgICAgICBjb21wLnN0YXJ0c1dpdGgoJ2xpYjonKVxuICAgICAgICAgID8gJ2xpYidcbiAgICAgICAgICA6IGNvbXBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgYCR7Y2FiYWwubmFtZX06JHtjb21wY31gKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaChjb21wKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGNvbnN0IGluaXRyZXMgPSBhd2FpdCB0aGlzLmdoY2kud2FpdFJlYWR5KClcbiAgICB0aGlzLnByb21wdCA9IGluaXRyZXMucHJvbXB0WzFdXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyIChpbml0cmVzLnN0ZGVycilcbiAgICBhd2FpdCB0aGlzLm9uSW5pdGlhbExvYWQoKVxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHByb3RlY3RlZCBlcnJvcnNGcm9tU3RkZXJyIChzdGRlcnI6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5maWx0ZXIoKHtfdGltZX0pID0+IERhdGUubm93KCkgLSBfdGltZSA8IDEwMDAwKVxuICAgIGxldCBoYXNFcnJvcnMgPSBmYWxzZVxuICAgIGZvciAoY29uc3QgZXJyIG9mIHN0ZGVyci5qb2luKCdcXG4nKS5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gdGhpcy5wYXJzZU1lc3NhZ2UoZXJyKVxuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB0aGlzLmVycm9ycy5wdXNoKGVycm9yKVxuICAgICAgICAgIGlmIChlcnJvci5zZXZlcml0eSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy51cGkpIHtcbiAgICAgIHRoaXMudXBpLnNldE1lc3NhZ2VzKHRoaXMuZXJyb3JzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UgKG1lc3NhZ2U6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgbGV0IGxpbmVzID0gbWVzc2FnZS5zcGxpdCgnXFxuJykuZmlsdGVyKCh4KSA9PiAheC5tYXRjaCgvXlxccyokLykpXG4gICAgbGV0IG1pbkluZGVudDogbnVtYmVyIHwgbnVsbCA9IG51bGxcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKSFcbiAgICAgIGNvbnN0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgIGlmICghbWluSW5kZW50IHx8IGxpbmVJbmRlbnQgPCBtaW5JbmRlbnQpIHsgbWluSW5kZW50ID0gbGluZUluZGVudCB9XG4gICAgfVxuICAgIGlmIChtaW5JbmRlbnQpIHtcbiAgICAgIGxpbmVzID0gbGluZXMubWFwKChsaW5lKSA9PiBsaW5lLnNsaWNlKG1pbkluZGVudCEpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByb3RlY3RlZCBwYXJzZU1lc3NhZ2UgKHJhdzogc3RyaW5nKTogSUVycm9ySXRlbSB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF0aGlzLmN3ZCkgeyByZXR1cm4gfVxuICAgIGNvbnN0IG1hdGNoTG9jID0gL14oLispOihcXGQrKTooXFxkKyk6KD86IChcXHcrKTopP1sgXFx0XSooXFxbW15cXF1dK1xcXSk/WyBcXHRdKlxcbj8oW15dKikvXG4gICAgaWYgKHJhdyAmJiByYXcudHJpbSgpICE9PSAnJykge1xuICAgICAgY29uc3QgbWF0Y2hlZCA9IHJhdy5tYXRjaChtYXRjaExvYylcbiAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgIGNvbnN0IFtmaWxlYywgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHQsIG1zZ106IEFycmF5PHN0cmluZyB8IHVuZGVmaW5lZD4gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFNldmVyaXR5ID0gcmF3VHlwID8gcmF3VHlwLnRvTG93ZXJDYXNlKCkgOiAnZXJyb3InXG4gICAgICAgIGxldCBmaWxlOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgICAgaWYgKGZpbGVjID09PSAnPGludGVyYWN0aXZlPicpIHtcbiAgICAgICAgICBmaWxlID0gdW5kZWZpbmVkXG4gICAgICAgICAgdHlwID0gJ3JlcGwnXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmlsZSA9IGZpbGVjXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVyaTogZmlsZSA/IHRoaXMuY3dkLmdldEZpbGUodGhpcy5jd2QucmVsYXRpdml6ZShmaWxlKSkuZ2V0UGF0aCgpIDogdW5kZWZpbmVkLFxuICAgICAgICAgIHBvc2l0aW9uOiBbcGFyc2VJbnQobGluZSBhcyBzdHJpbmcsIDEwKSAtIDEsIHBhcnNlSW50KGNvbCBhcyBzdHJpbmcsIDEwKSAtIDFdLFxuICAgICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgIHRleHQ6IHRoaXMudW5pbmRlbnRNZXNzYWdlKChtc2cgYXMgc3RyaW5nICYge3RyaW1SaWdodCAoKTogc3RyaW5nfSkudHJpbVJpZ2h0KCkpLFxuICAgICAgICAgICAgaGlnaGxpZ2h0ZXI6ICdoaW50Lm1lc3NhZ2UuaGFza2VsbCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgIHNldmVyaXR5OiB0eXAsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbWVzc2FnZTogcmF3LFxuICAgICAgICAgIHNldmVyaXR5OiAncmVwbCcsXG4gICAgICAgICAgX3RpbWU6IERhdGUubm93KCksXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==