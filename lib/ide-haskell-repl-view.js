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
const editor_1 = require("./editor");
const ghci_1 = require("./ghci");
const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g;
class IdeHaskellReplView {
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }) {
        this.uri = uri;
        this.history = history;
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
    }
    historyForward() {
    }
    ghciReload() {
        this.ghci.reload();
    }
    ghciReloadRepeat() {
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
            history: this.history,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsMkNBQTBDO0FBQzFDLGdEQUFnRDtBQUNoRCw2QkFBNkI7QUFDN0IsMkNBQWlDO0FBRWpDLHFDQUErQjtBQUMvQixxQ0FBK0I7QUFDL0IsaUNBQTJCO0FBRTNCLE1BQU0sWUFBWSxHQUFHLHlDQUF5QyxDQUFBO0FBb0M5RDtJQWVFLFlBQWEsVUFBVSxFQUFFLEVBQ3ZCLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLEdBQ25GO1FBQ1gsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUE7UUFDZCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQTtRQUN0QixJQUFJLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtRQUMxQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQTtRQUVoQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUE7UUFFN0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENB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O29CQUNaLFFBQVEsRUFBRSxNQUFNO29CQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtpQkFDbEIsQ0FBQTtZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBeFhELGdEQXdYQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbXBvc2l0ZURpc3Bvc2FibGUsXG4gIFRleHRFZGl0b3IsXG59IGZyb20gJ2F0b20nXG5pbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCBoaWdobGlnaHRTeW5jID0gcmVxdWlyZSgnYXRvbS1oaWdobGlnaHQnKVxuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQge0J1dHRvbn0gZnJvbSAnLi9idXR0b24nXG5pbXBvcnQge0VkaXRvcn0gZnJvbSAnLi9lZGl0b3InXG5pbXBvcnQge0dIQ0l9IGZyb20gJy4vZ2hjaSdcblxuY29uc3QgdGVybUVzY2FwZVJ4ID0gL1xceDFCXFxbKFswLTldezEsMn0oO1swLTldezEsMn0pPyk/W218S10vZ1xuXG50eXBlIFVQSSA9IGFueVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxufVxuXG5pbnRlcmZhY2UgSVZpZXdTdGF0ZU91dHB1dCBleHRlbmRzIElWaWV3U3RhdGUge1xuICBkZXNlcmlhbGl6ZXI6IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbn1cblxudHlwZSBTZXZlcml0eSA9ICdlcnJvcicgfCAnd2FybmluZycgfCAncmVwbCcgfCBzdHJpbmdcblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIHtcbiAgdXJpPzogc3RyaW5nLFxuICBwb3NpdGlvbj86IFtudW1iZXIsIG51bWJlcl0sXG4gIG1lc3NhZ2U6IHN0cmluZyxcbiAgY29udGV4dD86IHN0cmluZyxcbiAgc2V2ZXJpdHk6IFNldmVyaXR5LFxuICBfdGltZTogbnVtYmVyLFxufVxuXG5kZWNsYXJlIGludGVyZmFjZSBJTXlTdHJpbmcgZXh0ZW5kcyBTdHJpbmcge1xuICB0cmltUmlnaHQgKCk6IElNeVN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxWaWV3IHtcbiAgcHVibGljIHJlZnM6IHtba2V5OiBzdHJpbmddOiBhbnl9XG4gIHB1YmxpYyBlZGl0b3I6IFRleHRFZGl0b3JcbiAgcHJpdmF0ZSBnaGNpOiBHSENJXG4gIHByaXZhdGUgY3dkOiBBdG9tVHlwZXMuRGlyZWN0b3J5XG4gIHByaXZhdGUgcHJvbXB0OiBzdHJpbmdcbiAgcHJpdmF0ZSB1cGk6IFVQSVxuICBwcml2YXRlIG91dHB1dEZvbnRGYW1pbHk6IGFueVxuICBwcml2YXRlIG91dHB1dEZvbnRTaXplOiBhbnlcbiAgcHJpdmF0ZSBtZXNzYWdlczogSUNvbnRlbnRJdGVtW11cbiAgcHJpdmF0ZSBlcnJvcnM6IElFcnJvckl0ZW1bXVxuICBwcml2YXRlIGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJpdmF0ZSBoaXN0b3J5OiBzdHJpbmdbXVxuICBwcml2YXRlIHVyaTogc3RyaW5nXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHtcbiAgICB1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXQgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCcpLFxuICB9OiBJVmlld1N0YXRlKSB7XG4gICAgdGhpcy51cmkgPSB1cmlcbiAgICB0aGlzLmhpc3RvcnkgPSBoaXN0b3J5XG4gICAgdGhpcy5zZXRBdXRvUmVsb2FkUmVwZWF0KGF1dG9SZWxvYWRSZXBlYXQpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcbiAgICB0aGlzLmVycm9ycyA9IFtdXG5cbiAgICB0aGlzLmVkaXRvciA9IG5ldyBUZXh0RWRpdG9yKHtcbiAgICAgIGxpbmVOdW1iZXJHdXR0ZXJWaXNpYmxlOiBmYWxzZSxcbiAgICAgIHNvZnRXcmFwcGVkOiB0cnVlLFxuICAgICAgZ3JhbW1hcjogYXRvbS5ncmFtbWFycy5ncmFtbWFyRm9yU2NvcGVOYW1lKCdzb3VyY2UuaGFza2VsbCcpLFxuICAgIH0pXG5cbiAgICBhdG9tLnRleHRFZGl0b3JzLmFkZCh0aGlzLmVkaXRvcilcblxuICAgIHRoaXMubWVzc2FnZXMgPSBjb250ZW50IHx8IFtdXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0VVJJKCkgPT09IHRoaXMudXJpKSB7XG4gICAgICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkU2F2ZSgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZSkgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YFxuICAgIH0pKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250RmFtaWx5JywgKGZvbnRGYW1pbHkpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udEZhbWlseSA9IGZvbnRGYW1pbHlcbiAgICB9KSlcblxuICAgIHRoaXMuY3dkID0gVXRpbC5nZXRSb290RGlyKHRoaXMudXJpKVxuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG5cbiAgICB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCAoKSB7XG4gICAgbGV0IGlucCA9IHRoaXMuZWRpdG9yLmdldEJ1ZmZlcigpLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoJycpXG4gICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChpbnApXG4gIH1cblxuICBwdWJsaWMgY29weVRleHQgKGNvbW1hbmQpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KGNvbW1hbmQpXG4gICAgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgbGV0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgdGhpcy5lcnJvcnMgPSB0aGlzLmVycm9ycy5maWx0ZXIoKHtfdGltZX0pID0+IERhdGUubm93KCkgLSBfdGltZSA8IDEwMDAwKVxuICAgIGxldCByZXMgPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhpbnAsICh0eXBlLCB0ZXh0KSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKHR5cGUsIHRleHQpXG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RkaW4nOlxuICAgICAgICAgIHRleHQgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHt0ZXh0OiBpbnAuam9pbignXFxuJyksIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLWlucHV0LXRleHQnfSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdzdGRvdXQnOlxuICAgICAgICAgIHRleHQgJiYgdGhpcy5tZXNzYWdlcy5wdXNoKHt0ZXh0LCBobDogdHJ1ZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQtdGV4dCd9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3Byb21wdCc6XG4gICAgICAgICAgdGhpcy5wcm9tcHQgPSB0ZXh0WzFdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDogYnJlYWtcbiAgICAgIH1cbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9KVxuICAgIGZvciAobGV0IGVyciBvZiByZXMuc3RkZXJyLmpvaW4oJ1xcbicpLnNwbGl0KC9cXG4oPz1cXFMpLykpIHtcbiAgICAgIGVyciAmJiB0aGlzLmVycm9ycy5wdXNoKHRoaXMucGFyc2VNZXNzYWdlKGVycikpXG4gICAgfVxuICAgIGNvbnNvbGUuZXJyb3IodGhpcy5lcnJvcnMpXG4gICAgaWYgKHRoaXMudXBpKSB7XG4gICAgICB0aGlzLnVwaS5tZXNzYWdlcy5zZXQodGhpcy5lcnJvcnMpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlKClcbiAgICB9XG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGhpc3RvcnlCYWNrICgpIHtcbiAgICAvLyBUT0RPXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUZvcndhcmQgKCkge1xuICAgIC8vIFRPRE9cbiAgfVxuXG4gIHB1YmxpYyBnaGNpUmVsb2FkICgpIHtcbiAgICB0aGlzLmdoY2kucmVsb2FkKClcbiAgfVxuXG4gIHB1YmxpYyBnaGNpUmVsb2FkUmVwZWF0ICgpIHtcbiAgICAvLyBUT0RPXG4gIH1cblxuICBwdWJsaWMgdG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCAoKSB7XG4gICAgdGhpcy5zZXRBdXRvUmVsb2FkUmVwZWF0KCF0aGlzLmdldEF1dG9SZWxvYWRSZXBlYXQoKSlcbiAgfVxuXG4gIHB1YmxpYyBzZXRBdXRvUmVsb2FkUmVwZWF0IChhdXRvUmVsb2FkUmVwZWF0KSB7XG4gICAgdGhpcy5hdXRvUmVsb2FkUmVwZWF0ID0gYXV0b1JlbG9hZFJlcGVhdFxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXRBdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0aGlzLmdoY2kuaW50ZXJydXB0KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnZXRDb21wbGV0aW9ucyAocHJlZml4KSB7XG4gICAgaWYgKCFwcmVmaXgudHJpbSgpKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgbGV0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLnNlbmRDb21wbGV0aW9uUmVxdWVzdCgpXG4gICAgc3Rkb3V0LnNoaWZ0KClcbiAgICByZXR1cm4gZmlsdGVyKHN0ZG91dCwgcHJlZml4KS5tYXAoKHRleHQpID0+ICh7dGV4dDogdGV4dC5zbGljZSgxLCAtMSl9KSlcbiAgfVxuXG4gIHB1YmxpYyBnZXRVUkkgKCkge1xuICAgIHJldHVybiBgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGdldFRpdGxlICgpIHtcbiAgICByZXR1cm4gYFJFUEw6ICR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIGlmICh0aGlzLmdoY2kpIHtcbiAgICAgIHRoaXMuZ2hjaS5kZXN0cm95KClcbiAgICB9XG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgfVxuXG4gIHB1YmxpYyBzZXJpYWxpemUgKCk6IElWaWV3U3RhdGVPdXRwdXQge1xuICAgIHJldHVybiB7XG4gICAgICBkZXNlcmlhbGl6ZXI6ICdJZGVIYXNrZWxsUmVwbFZpZXcnLFxuICAgICAgdXJpOiB0aGlzLnVyaSxcbiAgICAgIGNvbnRlbnQ6IHRoaXMubWVzc2FnZXMsXG4gICAgICBoaXN0b3J5OiB0aGlzLmhpc3RvcnksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0OiB0aGlzLmF1dG9SZWxvYWRSZXBlYXQsXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtb3V0cHV0IG5hdGl2ZS1rZXktYmluZGluZ3NcIiB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17e2ZvbnRTaXplOiB0aGlzLm91dHB1dEZvbnRTaXplLCBmb250RmFtaWx5OiB0aGlzLm91dHB1dEZvbnRGYW1pbHl9fT5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVkaXRvclwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZWRpdG9yLWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgPEVkaXRvciByZWY9XCJlZGl0b3JcIiBlbGVtZW50PXt0aGlzLmVkaXRvci5lbGVtZW50fVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cInJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlJlbG9hZCBmaWxlIGFuZCByZXBlYXQgbGFzdCBjb21tYW5kXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJUb2dnbGUgcmVsb2FkLXJlcGVhdCBvbiBmaWxlIHNhdmVcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBzdGF0ZT17dGhpcy5hdXRvUmVsb2FkUmVwZWF0fVxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJJbnRlcnJ1cHQgY3VycmVudCBjb21wdXRhdGlvblwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlckVyckRpdiAoKSB7XG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVycm9yXCI+XG4gICAgICAgICAge3RoaXMuZXJyb3JzIC8qVE9ETyByZW5kZXIqL31cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJQcm9tcHQgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2Pnt0aGlzLnByb21wdCB8fCAnJ30gJmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlcy5tYXAoKHt0ZXh0LCBjbHMsIGhsfTogSUNvbnRlbnRJdGVtKSA9PiB7XG4gICAgICBsZXQgY2xlYW5UZXh0ID0gdGV4dC5yZXBsYWNlKHRlcm1Fc2NhcGVSeCwgJycpXG4gICAgICBpZiAoaGwpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cHJlIGNsYXNzTmFtZT17Y2xzfVxuICAgICAgICAgICAgaW5uZXJIVE1MPXtoaWdobGlnaHRTeW5jKHtmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZX0pfSA+XG4gICAgICAgICAgPC9wcmU+XG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiA8cHJlIGNsYXNzTmFtZT17Y2xzfT57Y2xlYW5UZXh0fTwvcHJlPlxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZSAoKSB7XG4gICAgcmV0dXJuIGV0Y2gudXBkYXRlKHRoaXMpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGluaXRpYWxpemUgKHVwaVByb21pc2U6IFByb21pc2U8VVBJPikge1xuICAgIHRoaXMudXBpID0gYXdhaXQgdXBpUHJvbWlzZVxuICAgIGlmICghdGhpcy51cGkpIHsgcmV0dXJuIHRoaXMucnVuUkVQTChudWxsKSB9XG5cbiAgICB0cnkge1xuICAgICAgbGV0IGJ1aWxkZXIgPSBhd2FpdCB0aGlzLnVwaS5wYXJhbXMuZ2V0KCdpZGUtaGFza2VsbC1jYWJhbCcsICdidWlsZGVyJylcbiAgICAgIHRoaXMucnVuUkVQTCgoYnVpbGRlciB8fCB7fSkubmFtZSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGVycm9yLnRvU3RyaW5nKCksIHtcbiAgICAgICAgICBkZXRhaWw6IGVycm9yLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFdhcm5pbmcoXCJDYW4ndCBydW4gUkVQTCB3aXRob3V0IGtub3dpbmcgd2hhdCBidWlsZGVyIHRvIHVzZVwiKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcnVuUkVQTCAoYnVpbGRlcjogc3RyaW5nKSB7XG4gICAgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS53b3Jrc3BhY2Uub25EaWRDaGFuZ2VBY3RpdmVQYW5lSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgaWYgKGl0ZW0gPT09IHRoaXMpIHsgc2V0SW1tZWRpYXRlKCgpID0+IHsgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpIH0pIH1cbiAgICB9KSlcblxuICAgIGlmICghYnVpbGRlcikgeyBidWlsZGVyID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJykgfVxuICAgIGxldCBzdWJzdCA9IHtcbiAgICAgICduaXgtYnVpbGQnOiAnY2FiYWwnLFxuICAgICAgJ25vbmUnOiAnZ2hjaScsXG4gICAgfVxuICAgIGJ1aWxkZXIgPSAoc3Vic3RbYnVpbGRlcl0gfHwgYnVpbGRlcilcblxuICAgIGxldCBbY2FiYWxGaWxlXSA9XG4gICAgICB0aGlzLmN3ZC5nZXRFbnRyaWVzU3luYygpLmZpbHRlcigoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJiBmaWxlLmdldEJhc2VOYW1lKCkuZW5kc1dpdGgoJy5jYWJhbCcpKVxuXG4gICAgbGV0IGNhYmFsLCBjb21wXG4gICAgaWYgKGNhYmFsRmlsZSkge1xuICAgICAgbGV0IGNhYmFsQ29udGVudHMgPSBjYWJhbEZpbGUucmVhZFN5bmMoKVxuICAgICAgY2FiYWwgPSBVdGlsLnBhcnNlRG90Q2FiYWxTeW5jKGNhYmFsQ29udGVudHMpXG4gICAgICBbY29tcF0gPSBVdGlsLmdldENvbXBvbmVudEZyb21GaWxlU3luYyhjYWJhbENvbnRlbnRzLCB0aGlzLmN3ZC5yZWxhdGl2aXplKHRoaXMudXJpKSlcbiAgICB9XG4gICAgbGV0IGNvbW1hbmRQYXRoID0gYXRvbS5jb25maWcuZ2V0KGBpZGUtaGFza2VsbC1yZXBsLiR7YnVpbGRlcn1QYXRoYClcblxuICAgIGxldCBhcmdzID0ge1xuICAgICAgc3RhY2s6IFsnZ2hjaSddLFxuICAgICAgY2FiYWw6IFsncmVwbCddLFxuICAgICAgZ2hjaTogW10sXG4gICAgfVxuICAgIGxldCBleHRyYUFyZ3MgPSB7XG4gICAgICBzdGFjazogKHgpID0+ICctLWdoY2ktb3B0aW9ucz1cIiN7eH1cIicsXG4gICAgICBjYWJhbDogKHgpID0+ICctLWdoYy1vcHRpb249I3t4fScsXG4gICAgICBnaGNpOiAoeCkgPT4geCxcbiAgICB9XG5cbiAgICBpZiAoIWFyZ3NbYnVpbGRlcl0pIHsgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGJ1aWxkZXIgI3tidWlsZGVyfScpIH1cbiAgICBsZXQgY29tbWFuZEFyZ3MgPSBhcmdzW2J1aWxkZXJdXG5cbiAgICBjb21tYW5kQXJncy5wdXNoKC4uLihhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJykubWFwKGV4dHJhQXJnc1tidWlsZGVyXSkpKVxuXG4gICAgaWYgKGNvbXApIHtcbiAgICAgIGlmIChidWlsZGVyID09PSAnc3RhY2snKSB7XG4gICAgICAgIGlmIChjb21wLnN0YXJ0c1dpdGgoJ2xpYjonKSkge1xuICAgICAgICAgIGNvbXAgPSAnbGliJ1xuICAgICAgICB9XG4gICAgICAgIGNvbXAgPSBgJHtjYWJhbC5uYW1lfToke2NvbXB9YFxuICAgICAgICBjb21tYW5kQXJncy5wdXNoKCctLW1haW4taXMnLCBjb21wKVxuICAgICAgfSBlbHNlIHsgY29tbWFuZEFyZ3MucHVzaChjb21wKSB9XG4gICAgfVxuXG4gICAgdGhpcy5naGNpID0gbmV3IEdIQ0koe1xuICAgICAgYXRvbVBhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG4gICAgICBjb21tYW5kOiBjb21tYW5kUGF0aCxcbiAgICAgIGFyZ3M6IGNvbW1hbmRBcmdzLFxuICAgICAgY3dkOiB0aGlzLmN3ZC5nZXRQYXRoKCksXG4gICAgICBvbkV4aXQ6IGFzeW5jIChjb2RlKSA9PiB0aGlzLmRlc3Ryb3koKSxcbiAgICB9KVxuXG4gICAgYXdhaXQgdGhpcy5naGNpLndhaXRSZWFkeSgpXG5cbiAgICB0aGlzLmdoY2kubG9hZCh0aGlzLnVyaSwgKHR5cGUsIHRleHQpID0+IHtcbiAgICAgIGlmICh0eXBlID09PSAncHJvbXB0Jykge1xuICAgICAgICB0aGlzLnByb21wdCA9IHRleHRbMV1cbiAgICAgICAgdGhpcy51cGRhdGUoKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIHVuaW5kZW50TWVzc2FnZSAobWVzc2FnZSk6IHN0cmluZyB7XG4gICAgbGV0IGxpbmVzID0gbWVzc2FnZS5zcGxpdCgnXFxuJykuZmlsdGVyKCh4KSA9PiAheC5tYXRjaCgvXlxccyokLykpXG4gICAgbGV0IG1pbkluZGVudCA9IG51bGxcbiAgICBmb3IgKGxldCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBsZXQgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKi8pXG4gICAgICBsZXQgbGluZUluZGVudCA9IG1hdGNoWzBdLmxlbmd0aFxuICAgICAgaWYgKGxpbmVJbmRlbnQgPCBtaW5JbmRlbnQgfHwgIW1pbkluZGVudCkgeyBtaW5JbmRlbnQgPSBsaW5lSW5kZW50IH1cbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihtaW5JbmRlbnQsIGxpbmVzKVxuICAgIGlmIChtaW5JbmRlbnQpIHtcbiAgICAgIGxpbmVzID0gbGluZXMubWFwKChsaW5lKSA9PiBsaW5lLnNsaWNlKG1pbkluZGVudCkpXG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZU1lc3NhZ2UgKHJhdyk6IElFcnJvckl0ZW0ge1xuICAgIGxldCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9cXHMqKFxcW1teXFxdXStcXF0pPy9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBsZXQgbWF0Y2hlZCA9IHJhdy5tYXRjaChtYXRjaExvYylcbiAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgIGxldCBtc2cgPSByYXcuc3BsaXQoJ1xcbicpLnNsaWNlKDEpLmpvaW4oJ1xcbicpXG4gICAgICAgIGxldCBbZmlsZSwgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHRdOiBTdHJpbmdbXSA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgaWYgKGZpbGUgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSBudWxsXG4gICAgICAgICAgdHlwID0gJ3JlcGwnXG4gICAgICAgIH1cblxuICAgICAgICAvLyBOT1RFOiB0aGlzIGlzIGRvbmUgYmVjYXVzZSB0eXBlc2NyaXB0IGluc2lzdHMgc3RyaW5ncyBkb250IGhhdmVcbiAgICAgICAgLy8gdHJpbVJpZ2h0KCkgbWV0aG9kXG4gICAgICAgIGxldCBtc2dhbnkgPSBtc2cgYXMgSU15U3RyaW5nXG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IG51bGwsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZTogdGhpcy51bmluZGVudE1lc3NhZ2UobXNnYW55LnRyaW1SaWdodCgpKSxcbiAgICAgICAgICBjb250ZXh0OiBjb250ZXh0IGFzIHN0cmluZyxcbiAgICAgICAgICBzZXZlcml0eTogdHlwLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG1lc3NhZ2U6IHJhdyxcbiAgICAgICAgICBzZXZlcml0eTogJ3JlcGwnLFxuICAgICAgICAgIF90aW1lOiBEYXRlLm5vdygpLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=