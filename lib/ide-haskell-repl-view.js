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
const highlightSync = require("atom-highlight");
const etch = require("etch");
const fuzzaldrin_1 = require("fuzzaldrin");
const button_1 = require("./button");
const command_history_1 = require("./command-history");
const editor_1 = require("./editor");
const ghci_1 = require("./ghci");
const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g;
class IdeHaskellReplView {
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }) {
        this.uri = uri;
        this.history = new command_history_1.CommandHistory(history);
        this.setAutoReloadRepeat(autoReloadRepeat);
        this.disposables = new atom_1.CompositeDisposable();
        this.errors = [];
        this.editor = new atom_1.TextEditor({
            lineNumberGutterVisible: false,
            softWrapped: true,
            grammar: atom.grammars.grammarForScopeName('source.haskell'),
        });
        atom.textEditors.add(this.editor);
        this.messages = content || [];
        this.disposables.add(atom.workspace.observeTextEditors((editor) => {
            if (editor.getURI() === this.uri) {
                this.disposables.add(editor.onDidSave(() => {
                    if (this.autoReloadRepeat) {
                        this.ghciReloadRepeat();
                    }
                }));
            }
        }));
        this.disposables.add(atom.config.observe('editor.fontSize', (fontSize) => {
            this.outputFontSize = `${fontSize}px`;
        }));
        this.disposables.add(atom.config.observe('editor.fontFamily', (fontFamily) => {
            this.outputFontFamily = fontFamily;
        }));
        this.cwd = Util.getRootDir(this.uri);
        etch.initialize(this);
        this.initialize(upiPromise);
    }
    execCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let inp = this.editor.getBuffer().getText();
            this.editor.setText('');
            this.history.save(inp);
            return this.runCommand(inp);
        });
    }
    copyText(command) {
        this.editor.setText(command);
        this.editor.element.focus();
    }
    runCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            let inp = command.split('\n');
            this.errors = this.errors.filter(({ _time }) => Date.now() - _time < 10000);
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
            for (let err of res.stderr.join('\n').split(/\n(?=\S)/)) {
                err && this.errors.push(this.parseMessage(err));
            }
            console.error(this.errors);
            if (this.upi) {
                this.upi.messages.set(this.errors);
            }
            else {
                this.update();
            }
            return res;
        });
    }
    historyBack() {
        let current = this.editor.getText();
        this.editor.setText(this.history.goBack(current));
    }
    historyForward() {
        this.editor.setText(this.history.goForward());
    }
    ghciReload() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.ghci.reload();
        });
    }
    ghciReloadRepeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let command = this.history.goBack('');
            return this.runCommand(command);
        });
    }
    toggleAutoReloadRepeat() {
        this.setAutoReloadRepeat(!this.getAutoReloadRepeat());
    }
    setAutoReloadRepeat(autoReloadRepeat) {
        this.autoReloadRepeat = autoReloadRepeat;
        this.update();
    }
    getAutoReloadRepeat() {
        return this.autoReloadRepeat;
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
    getURI() {
        return `ide-haskell://repl/${this.uri}`;
    }
    getTitle() {
        return `REPL: ${this.uri}`;
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            etch.destroy(this);
            if (this.ghci) {
                this.ghci.destroy();
            }
            this.disposables.dispose();
        });
    }
    serialize() {
        return {
            deserializer: 'IdeHaskellReplView',
            uri: this.uri,
            content: this.messages,
            history: this.history.serialize(),
            autoReloadRepeat: this.autoReloadRepeat,
        };
    }
    render() {
        return (etch.dom("div", { className: "ide-haskell-repl" },
            etch.dom("div", { className: "ide-haskell-repl-output native-key-bindings", tabIndex: "-1", style: { fontSize: this.outputFontSize, fontFamily: this.outputFontFamily } }, this.renderOutput()),
            this.renderErrDiv(),
            this.renderPrompt(),
            etch.dom("div", { className: "ide-haskell-repl-editor" },
                etch.dom("div", { className: "editor-container" },
                    etch.dom(editor_1.Editor, { ref: "editor", element: this.editor.element })),
                etch.dom(button_1.Button, { cls: "reload-repeat", tooltip: "Reload file and repeat last command", command: "ide-haskell-repl:reload-repeat", parent: this }),
                etch.dom(button_1.Button, { cls: "auto-reload-repeat", tooltip: "Toggle reload-repeat on file save", command: "ide-haskell-repl:toggle-auto-reload-repeat", state: this.autoReloadRepeat, parent: this }),
                etch.dom(button_1.Button, { cls: "interrupt", tooltip: "Interrupt current computation", command: "ide-haskell-repl:ghci-interrupt", parent: this }))));
    }
    renderErrDiv() {
        if (!this.upi) {
            return (etch.dom("div", { className: "ide-haskell-repl-error" }, this.errors));
        }
        else {
            return null;
        }
    }
    renderPrompt() {
        return (etch.dom("div", null,
            this.prompt || '',
            " >"));
    }
    renderOutput() {
        return this.messages.map(({ text, cls, hl }) => {
            let cleanText = text.replace(termEscapeRx, '');
            if (hl) {
                return (etch.dom("pre", { className: cls, innerHTML: highlightSync({ fileContents: cleanText, scopeName: 'source.haskell', nbsp: false }) }));
            }
            else {
                return etch.dom("pre", { className: cls }, cleanText);
            }
        });
    }
    update() {
        return etch.update(this);
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
            this.editor.element.focus();
            this.disposables.add(atom.workspace.onDidChangeActivePaneItem((item) => {
                if (item === this) {
                    setImmediate(() => { this.editor.element.focus(); });
                }
            }));
            if (!builder) {
                builder = atom.config.get('ide-haskell-repl.defaultRepl');
            }
            let subst = {
                'nix-build': 'cabal',
                'none': 'ghci',
            };
            builder = (subst[builder] || builder);
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
            yield this.ghci.waitReady();
            this.ghci.load(this.uri, (type, text) => {
                if (type === 'prompt') {
                    this.prompt = text[1];
                    this.update();
                }
            });
        });
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
                    message: this.unindentMessage(msgany.trimRight()),
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
exports.IdeHaskellReplView = IdeHaskellReplView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsMkNBQTBDO0FBQzFDLGdEQUFnRDtBQUNoRCw2QkFBNkI7QUFDN0IsMkNBQWlDO0FBRWpDLHFDQUErQjtBQUMvQix1REFBZ0Q7QUFDaEQscUNBQStCO0FBQy9CLGlDQUEyQjtBQUUzQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQW9DOUQ7SUFlRSxZQUFhLFVBQVUsRUFBRSxFQUN2QixHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxHQUNuRjtRQUNYLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFBO1FBQ2QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGdDQUFjLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDMUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLENBQUE7UUFDMUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7UUFDNUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUE7UUFFaEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGlCQUFVLENBQUM7WUFDM0IsdUJBQXVCLEVBQUUsS0FBSztZQUM5QixXQUFXLEVBQUUsSUFBSTtZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQztTQUM3RCxDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFakMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLElBQUksRUFBRSxDQUFB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QkFDTCxHQUFHLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSTtvQkFDeEUsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQWMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsUUFBUSxDQUFDLEdBQWEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdFLE9BQU8sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDakQsT0FBTyxFQUFFLE9BQWlCO29CQUMxQixRQUFRLEVBQUUsR0FBRztvQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUM7b0JBQ0wsT0FBTyxFQUFFLEdBQUc7b0JBQ1osUUFBUSxFQUFFLE1BQU07b0JBQ2hCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUEzWEQsZ0RBMlhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgVGV4dEVkaXRvcixcbn0gZnJvbSAnYXRvbSdcbmltcG9ydCAqIGFzIFV0aWwgZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IGhpZ2hsaWdodFN5bmMgPSByZXF1aXJlKCdhdG9tLWhpZ2hsaWdodCcpXG5pbXBvcnQgZXRjaCA9IHJlcXVpcmUoJ2V0Y2gnKVxuaW1wb3J0IHtmaWx0ZXJ9IGZyb20gJ2Z1enphbGRyaW4nXG5cbmltcG9ydCB7QnV0dG9ufSBmcm9tICcuL2J1dHRvbidcbmltcG9ydCB7Q29tbWFuZEhpc3Rvcnl9IGZyb20gJy4vY29tbWFuZC1oaXN0b3J5J1xuaW1wb3J0IHtFZGl0b3J9IGZyb20gJy4vZWRpdG9yJ1xuaW1wb3J0IHtHSENJfSBmcm9tICcuL2doY2knXG5cbmNvbnN0IHRlcm1Fc2NhcGVSeCA9IC9cXHgxQlxcWyhbMC05XXsxLDJ9KDtbMC05XXsxLDJ9KT8pP1ttfEtdL2dcblxudHlwZSBVUEkgPSBhbnlcblxuZXhwb3J0IGludGVyZmFjZSBJVmlld1N0YXRlIHtcbiAgdXJpPzogc3RyaW5nXG4gIGhpc3Rvcnk/OiBzdHJpbmdbXVxuICBhdXRvUmVsb2FkUmVwZWF0PzogYm9vbGVhblxuICBjb250ZW50PzogSUNvbnRlbnRJdGVtW11cbn1cblxuaW50ZXJmYWNlIElWaWV3U3RhdGVPdXRwdXQgZXh0ZW5kcyBJVmlld1N0YXRlIHtcbiAgZGVzZXJpYWxpemVyOiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudEl0ZW0ge1xuICB0ZXh0OiBzdHJpbmdcbiAgY2xzOiBzdHJpbmdcbiAgaGw/OiBib29sZWFuXG59XG5cbnR5cGUgU2V2ZXJpdHkgPSAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ3JlcGwnIHwgc3RyaW5nXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9ySXRlbSB7XG4gIHVyaT86IHN0cmluZyxcbiAgcG9zaXRpb24/OiBbbnVtYmVyLCBudW1iZXJdLFxuICBtZXNzYWdlOiBzdHJpbmcsXG4gIGNvbnRleHQ/OiBzdHJpbmcsXG4gIHNldmVyaXR5OiBTZXZlcml0eSxcbiAgX3RpbWU6IG51bWJlcixcbn1cblxuZGVjbGFyZSBpbnRlcmZhY2UgSU15U3RyaW5nIGV4dGVuZHMgU3RyaW5nIHtcbiAgdHJpbVJpZ2h0ICgpOiBJTXlTdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsVmlldyB7XG4gIHB1YmxpYyByZWZzOiB7W2tleTogc3RyaW5nXTogYW55fVxuICBwdWJsaWMgZWRpdG9yOiBUZXh0RWRpdG9yXG4gIHByaXZhdGUgZ2hjaTogR0hDSVxuICBwcml2YXRlIGN3ZDogQXRvbVR5cGVzLkRpcmVjdG9yeVxuICBwcml2YXRlIHByb21wdDogc3RyaW5nXG4gIHByaXZhdGUgdXBpOiBVUElcbiAgcHJpdmF0ZSBvdXRwdXRGb250RmFtaWx5OiBhbnlcbiAgcHJpdmF0ZSBvdXRwdXRGb250U2l6ZTogYW55XG4gIHByaXZhdGUgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByaXZhdGUgZXJyb3JzOiBJRXJyb3JJdGVtW11cbiAgcHJpdmF0ZSBhdXRvUmVsb2FkUmVwZWF0OiBib29sZWFuXG4gIHByaXZhdGUgaGlzdG9yeTogQ29tbWFuZEhpc3RvcnlcbiAgcHJpdmF0ZSB1cmk6IHN0cmluZ1xuICBwcml2YXRlIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG4gIGNvbnN0cnVjdG9yICh1cGlQcm9taXNlLCB7XG4gICAgdXJpLCBjb250ZW50LCBoaXN0b3J5LCBhdXRvUmVsb2FkUmVwZWF0ID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgfTogSVZpZXdTdGF0ZSkge1xuICAgIHRoaXMudXJpID0gdXJpXG4gICAgdGhpcy5oaXN0b3J5ID0gbmV3IENvbW1hbmRIaXN0b3J5KGhpc3RvcnkpXG4gICAgdGhpcy5zZXRBdXRvUmVsb2FkUmVwZWF0KGF1dG9SZWxvYWRSZXBlYXQpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcbiAgICB0aGlzLmVycm9ycyA9IFtdXG5cbiAgICB0aGlzLmVkaXRvciA9IG5ldyBUZXh0RWRpdG9yKHtcbiAgICAgIGxpbmVOdW1iZXJHdXR0ZXJWaXNpYmxlOiBmYWxzZSxcbiAgICAgIHNvZnRXcmFwcGVkOiB0cnVlLFxuICAgICAgZ3JhbW1hcjogYXRvbS5ncmFtbWFycy5ncmFtbWFyRm9yU2NvcGVOYW1lKCdzb3VyY2UuaGFza2VsbCcpLFxuICAgIH0pXG5cbiAgICBhdG9tLnRleHRFZGl0b3JzLmFkZCh0aGlzLmVkaXRvcilcblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0VVJJKCkgPT09IHRoaXMudXJpKSB7XG4gICAgICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkU2F2ZSgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZSkgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YFxuICAgIH0pKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250RmFtaWx5JywgKGZvbnRGYW1pbHkpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udEZhbWlseSA9IGZvbnRGYW1pbHlcbiAgICB9KSlcblxuICAgIHRoaXMuY3dkID0gVXRpbC5nZXRSb290RGlyKHRoaXMudXJpKVxuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG5cbiAgICB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCAoKSB7XG4gICAgbGV0IGlucCA9IHRoaXMuZWRpdG9yLmdldEJ1ZmZlcigpLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoJycpXG4gICAgdGhpcy5oaXN0b3J5LnNhdmUoaW5wKVxuICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoaW5wKVxuICB9XG5cbiAgcHVibGljIGNvcHlUZXh0IChjb21tYW5kKSB7XG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dChjb21tYW5kKVxuICAgIHRoaXMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkNvbW1hbmQgKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGxldCBpbnAgPSBjb21tYW5kLnNwbGl0KCdcXG4nKVxuICAgIHRoaXMuZXJyb3JzID0gdGhpcy5lcnJvcnMuZmlsdGVyKCh7X3RpbWV9KSA9PiBEYXRlLm5vdygpIC0gX3RpbWUgPCAxMDAwMClcbiAgICBsZXQgcmVzID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoaW5wLCAodHlwZSwgdGV4dCkgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcih0eXBlLCB0ZXh0KVxuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0ZGluJzpcbiAgICAgICAgICB0ZXh0ICYmIHRoaXMubWVzc2FnZXMucHVzaCh7dGV4dDogaW5wLmpvaW4oJ1xcbicpLCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0J30pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnc3Rkb3V0JzpcbiAgICAgICAgICB0ZXh0ICYmIHRoaXMubWVzc2FnZXMucHVzaCh7dGV4dCwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtb3V0cHV0LXRleHQnfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdwcm9tcHQnOlxuICAgICAgICAgIHRoaXMucHJvbXB0ID0gdGV4dFsxXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6IGJyZWFrXG4gICAgICB9XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfSlcbiAgICBmb3IgKGxldCBlcnIgb2YgcmVzLnN0ZGVyci5qb2luKCdcXG4nKS5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBlcnIgJiYgdGhpcy5lcnJvcnMucHVzaCh0aGlzLnBhcnNlTWVzc2FnZShlcnIpKVxuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKHRoaXMuZXJyb3JzKVxuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgdGhpcy51cGkubWVzc2FnZXMuc2V0KHRoaXMuZXJyb3JzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICAgIHJldHVybiByZXNcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5QmFjayAoKSB7XG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLmVkaXRvci5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0JhY2soY3VycmVudCkpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUZvcndhcmQgKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLmdoY2kucmVsb2FkKClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkUmVwZWF0ICgpIHtcbiAgICBsZXQgY29tbWFuZCA9IHRoaXMuaGlzdG9yeS5nb0JhY2soJycpXG4gICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICB9XG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuc2V0QXV0b1JlbG9hZFJlcGVhdCghdGhpcy5nZXRBdXRvUmVsb2FkUmVwZWF0KCkpXG4gIH1cblxuICBwdWJsaWMgc2V0QXV0b1JlbG9hZFJlcGVhdCAoYXV0b1JlbG9hZFJlcGVhdCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9IGF1dG9SZWxvYWRSZXBlYXRcbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0QXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMgKHByZWZpeCkge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGxldCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIHN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihzdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe3RleHQ6IHRleHQuc2xpY2UoMSwgLTEpfSkpXG4gIH1cblxuICBwdWJsaWMgZ2V0VVJJICgpIHtcbiAgICByZXR1cm4gYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBnZXRUaXRsZSAoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBldGNoLmRlc3Ryb3kodGhpcylcbiAgICBpZiAodGhpcy5naGNpKSB7XG4gICAgICB0aGlzLmdoY2kuZGVzdHJveSgpXG4gICAgfVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gIH1cblxuICBwdWJsaWMgc2VyaWFsaXplICgpOiBJVmlld1N0YXRlT3V0cHV0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzZXJpYWxpemVyOiAnSWRlSGFza2VsbFJlcGxWaWV3JyxcbiAgICAgIHVyaTogdGhpcy51cmksXG4gICAgICBjb250ZW50OiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgaGlzdG9yeTogdGhpcy5oaXN0b3J5LnNlcmlhbGl6ZSgpLFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogdGhpcy5hdXRvUmVsb2FkUmVwZWF0LFxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGxcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLW91dHB1dCBuYXRpdmUta2V5LWJpbmRpbmdzXCIgdGFiSW5kZXg9XCItMVwiXG4gICAgICAgICAgc3R5bGU9e3tmb250U2l6ZTogdGhpcy5vdXRwdXRGb250U2l6ZSwgZm9udEZhbWlseTogdGhpcy5vdXRwdXRGb250RmFtaWx5fX0+XG4gICAgICAgICAge3RoaXMucmVuZGVyT3V0cHV0KCl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7dGhpcy5yZW5kZXJFcnJEaXYoKX1cbiAgICAgICAge3RoaXMucmVuZGVyUHJvbXB0KCl9XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lZGl0b3JcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImVkaXRvci1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxFZGl0b3IgcmVmPVwiZWRpdG9yXCIgZWxlbWVudD17dGhpcy5lZGl0b3IuZWxlbWVudH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJFcnJEaXYgKCkge1xuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lcnJvclwiPlxuICAgICAgICAgIHt0aGlzLmVycm9ycyAvKlRPRE8gcmVuZGVyKi99XG4gICAgICAgIDwvZGl2PlxuICAgICAgKVxuICAgIH0gZWxzZSB7IHJldHVybiBudWxsIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyUHJvbXB0ICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdj57dGhpcy5wcm9tcHQgfHwgJyd9ICZndDs8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlck91dHB1dCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXMubWFwKCh7dGV4dCwgY2xzLCBobH06IElDb250ZW50SXRlbSkgPT4ge1xuICAgICAgbGV0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSh0ZXJtRXNjYXBlUngsICcnKVxuICAgICAgaWYgKGhsKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHByZSBjbGFzc05hbWU9e2Nsc31cbiAgICAgICAgICAgIGlubmVySFRNTD17aGlnaGxpZ2h0U3luYyh7ZmlsZUNvbnRlbnRzOiBjbGVhblRleHQsIHNjb3BlTmFtZTogJ3NvdXJjZS5oYXNrZWxsJywgbmJzcDogZmFsc2V9KX0gPlxuICAgICAgICAgIDwvcHJlPlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPHByZSBjbGFzc05hbWU9e2Nsc30+e2NsZWFuVGV4dH08L3ByZT5cbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGUgKCkge1xuICAgIHJldHVybiBldGNoLnVwZGF0ZSh0aGlzKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBpbml0aWFsaXplICh1cGlQcm9taXNlOiBQcm9taXNlPFVQST4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7IHJldHVybiB0aGlzLnJ1blJFUEwobnVsbCkgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxldCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkucGFyYW1zLmdldCgnaWRlLWhhc2tlbGwtY2FiYWwnLCAnYnVpbGRlcicpXG4gICAgICB0aGlzLnJ1blJFUEwoKGJ1aWxkZXIgfHwge30pLm5hbWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvcixcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFwiQ2FuJ3QgcnVuIFJFUEwgd2l0aG91dCBrbm93aW5nIHdoYXQgYnVpbGRlciB0byB1c2VcIilcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJ1blJFUEwgKGJ1aWxkZXI6IHN0cmluZykge1xuICAgIHRoaXMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20ud29ya3NwYWNlLm9uRGlkQ2hhbmdlQWN0aXZlUGFuZUl0ZW0oKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtID09PSB0aGlzKSB7IHNldEltbWVkaWF0ZSgoKSA9PiB7IHRoaXMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKSB9KSB9XG4gICAgfSkpXG5cbiAgICBpZiAoIWJ1aWxkZXIpIHsgYnVpbGRlciA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCcpIH1cbiAgICBsZXQgc3Vic3QgPSB7XG4gICAgICAnbml4LWJ1aWxkJzogJ2NhYmFsJyxcbiAgICAgICdub25lJzogJ2doY2knLFxuICAgIH1cbiAgICBidWlsZGVyID0gKHN1YnN0W2J1aWxkZXJdIHx8IGJ1aWxkZXIpXG5cbiAgICBsZXQgW2NhYmFsRmlsZV0gPVxuICAgICAgdGhpcy5jd2QuZ2V0RW50cmllc1N5bmMoKS5maWx0ZXIoKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSlcblxuICAgIGxldCBjYWJhbCwgY29tcFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGxldCBjYWJhbENvbnRlbnRzID0gY2FiYWxGaWxlLnJlYWRTeW5jKClcbiAgICAgIGNhYmFsID0gVXRpbC5wYXJzZURvdENhYmFsU3luYyhjYWJhbENvbnRlbnRzKVxuICAgICAgW2NvbXBdID0gVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZVN5bmMoY2FiYWxDb250ZW50cywgdGhpcy5jd2QucmVsYXRpdml6ZSh0aGlzLnVyaSkpXG4gICAgfVxuICAgIGxldCBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldChgaWRlLWhhc2tlbGwtcmVwbC4ke2J1aWxkZXJ9UGF0aGApXG5cbiAgICBsZXQgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBsZXQgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4KSA9PiAnLS1naGNpLW9wdGlvbnM9XCIje3h9XCInLFxuICAgICAgY2FiYWw6ICh4KSA9PiAnLS1naGMtb3B0aW9uPSN7eH0nLFxuICAgICAgZ2hjaTogKHgpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcignVW5rbm93biBidWlsZGVyICN7YnVpbGRlcn0nKSB9XG4gICAgbGV0IGNvbW1hbmRBcmdzID0gYXJnc1tidWlsZGVyXVxuXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi4oYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpLm1hcChleHRyYUFyZ3NbYnVpbGRlcl0pKSlcblxuICAgIGlmIChjb21wKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBpZiAoY29tcC5zdGFydHNXaXRoKCdsaWI6JykpIHtcbiAgICAgICAgICBjb21wID0gJ2xpYidcbiAgICAgICAgfVxuICAgICAgICBjb21wID0gYCR7Y2FiYWwubmFtZX06JHtjb21wfWBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgY29tcClcbiAgICAgIH0gZWxzZSB7IGNvbW1hbmRBcmdzLnB1c2goY29tcCkgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuXG4gICAgdGhpcy5naGNpLmxvYWQodGhpcy51cmksICh0eXBlLCB0ZXh0KSA9PiB7XG4gICAgICBpZiAodHlwZSA9PT0gJ3Byb21wdCcpIHtcbiAgICAgICAgdGhpcy5wcm9tcHQgPSB0ZXh0WzFdXG4gICAgICAgIHRoaXMudXBkYXRlKClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSB1bmluZGVudE1lc3NhZ2UgKG1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQgPSBudWxsXG4gICAgZm9yIChsZXQgbGluZSBvZiBsaW5lcykge1xuICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgbGV0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgIGlmIChsaW5lSW5kZW50IDwgbWluSW5kZW50IHx8ICFtaW5JbmRlbnQpIHsgbWluSW5kZW50ID0gbGluZUluZGVudCB9XG4gICAgfVxuICAgIGNvbnNvbGUuZXJyb3IobWluSW5kZW50LCBsaW5lcylcbiAgICBpZiAobWluSW5kZW50KSB7XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaW5JbmRlbnQpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VNZXNzYWdlIChyYXcpOiBJRXJyb3JJdGVtIHtcbiAgICBsZXQgbWF0Y2hMb2MgPSAvXiguKyk6KFxcZCspOihcXGQrKTooPzogKFxcdyspOik/XFxzKihcXFtbXlxcXV0rXFxdKT8vXG4gICAgaWYgKHJhdyAmJiByYXcudHJpbSgpICE9PSAnJykge1xuICAgICAgbGV0IG1hdGNoZWQgPSByYXcubWF0Y2gobWF0Y2hMb2MpXG4gICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICBsZXQgbXNnID0gcmF3LnNwbGl0KCdcXG4nKS5zbGljZSgxKS5qb2luKCdcXG4nKVxuICAgICAgICBsZXQgW2ZpbGUsIGxpbmUsIGNvbCwgcmF3VHlwLCBjb250ZXh0XTogU3RyaW5nW10gPSBtYXRjaGVkLnNsaWNlKDEpXG4gICAgICAgIGxldCB0eXA6IFNldmVyaXR5ID0gcmF3VHlwID8gcmF3VHlwLnRvTG93ZXJDYXNlKCkgOiAnZXJyb3InXG4gICAgICAgIGlmIChmaWxlID09PSAnPGludGVyYWN0aXZlPicpIHtcbiAgICAgICAgICBmaWxlID0gbnVsbFxuICAgICAgICAgIHR5cCA9ICdyZXBsJ1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTk9URTogdGhpcyBpcyBkb25lIGJlY2F1c2UgdHlwZXNjcmlwdCBpbnNpc3RzIHN0cmluZ3MgZG9udCBoYXZlXG4gICAgICAgIC8vIHRyaW1SaWdodCgpIG1ldGhvZFxuICAgICAgICBsZXQgbXNnYW55ID0gbXNnIGFzIElNeVN0cmluZ1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXJpOiBmaWxlID8gdGhpcy5jd2QuZ2V0RmlsZSh0aGlzLmN3ZC5yZWxhdGl2aXplKGZpbGUpKS5nZXRQYXRoKCkgOiBudWxsLFxuICAgICAgICAgIHBvc2l0aW9uOiBbcGFyc2VJbnQobGluZSBhcyBzdHJpbmcsIDEwKSAtIDEsIHBhcnNlSW50KGNvbCBhcyBzdHJpbmcsIDEwKSAtIDFdLFxuICAgICAgICAgIG1lc3NhZ2U6IHRoaXMudW5pbmRlbnRNZXNzYWdlKG1zZ2FueS50cmltUmlnaHQoKSksXG4gICAgICAgICAgY29udGV4dDogY29udGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19