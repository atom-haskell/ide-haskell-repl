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
const highlightSync = require("atom-highlight");
const etch = require("etch");
const ide_haskell_repl_base_1 = require("../ide-haskell-repl-base");
const button_1 = require("./button");
const editor_1 = require("./editor");
const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g;
class IdeHaskellReplView extends ide_haskell_repl_base_1.IdeHaskellReplBase {
    constructor(upiPromise, state) {
        super(upiPromise, state);
        this.disposables = new atom_1.CompositeDisposable();
        this.editor = new atom_1.TextEditor({
            lineNumberGutterVisible: false,
            softWrapped: true,
            grammar: atom.grammars.grammarForScopeName('source.haskell'),
        });
        atom.textEditors.add(this.editor);
        this.disposables.add(atom.workspace.observeTextEditors((editor) => {
            if (editor.getPath() === this.uri) {
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
        etch.initialize(this);
    }
    execCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            const inp = this.editor.getBuffer().getText();
            this.editor.setText('');
            this.history.save(inp);
            return this.runCommand(inp);
        });
    }
    copyText(command) {
        this.editor.setText(command);
        this.editor.element.focus();
    }
    historyBack() {
        const current = this.editor.getText();
        this.editor.setText(this.history.goBack(current));
    }
    historyForward() {
        this.editor.setText(this.history.goForward());
    }
    clear() {
        this.messages = [];
        this.update();
    }
    getURI() {
        return `ide-haskell://repl/${this.uri}`;
    }
    getTitle() {
        return `REPL: ${this.uri}`;
    }
    destroy() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            etch.destroy(this);
            this.disposables.dispose();
            _super("destroy").call(this);
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
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            const atEnd = !!this.refs &&
                (this.refs.output.scrollTop + this.refs.output.clientHeight >= this.refs.output.scrollHeight);
            const focused = !!this.refs && !!document.activeElement &&
                (this.refs.editor.element.contains(document.activeElement));
            yield etch.update(this);
            if (atEnd) {
                this.refs.output.scrollTop = this.refs.output.scrollHeight - this.refs.output.clientHeight;
            }
            if (focused) {
                this.refs.editor.element.focus();
            }
        });
    }
    render() {
        return (etch.dom("div", { className: "ide-haskell-repl" },
            etch.dom("div", { ref: "output", className: "ide-haskell-repl-output native-key-bindings", tabIndex: "-1", style: { fontSize: this.outputFontSize, fontFamily: this.outputFontFamily } }, this.renderOutput()),
            this.renderErrDiv(),
            etch.dom("div", { className: "button-container" },
                this.renderPrompt(),
                etch.dom(button_1.Button, { cls: "reload-repeat", tooltip: "Reload file and repeat last command", command: "ide-haskell-repl:reload-repeat", parent: this }),
                etch.dom(button_1.Button, { cls: "auto-reload-repeat", tooltip: "Toggle reload-repeat on file save", command: "ide-haskell-repl:toggle-auto-reload-repeat", state: this.autoReloadRepeat, parent: this }),
                etch.dom(button_1.Button, { cls: "interrupt", tooltip: "Interrupt current computation", command: "ide-haskell-repl:ghci-interrupt", parent: this }),
                etch.dom(button_1.Button, { cls: "clear", tooltip: "Clear output", command: "ide-haskell-repl:clear-output", parent: this })),
            etch.dom("div", { className: "ide-haskell-repl-editor" },
                etch.dom("div", { className: "editor-container" },
                    etch.dom(editor_1.Editor, { ref: "editor", element: this.editor.element })))));
    }
    onInitialLoad() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            const res = yield this.ghci.load(this.uri);
            this.prompt = res.prompt[1];
            this.errorsFromStderr(res.stderr);
            return _super("onInitialLoad").call(this);
        });
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
        return (etch.dom("div", { class: "repl-prompt" },
            this.prompt || '',
            ">"));
    }
    renderOutput() {
        const maxMsg = atom.config.get('ide-haskell-repl.maxMessages');
        if (maxMsg > 0) {
            this.messages = this.messages.slice(-maxMsg);
        }
        return this.messages.map((msg) => {
            const { text, cls, hl } = msg;
            let { hlcache } = msg;
            const cleanText = text.replace(termEscapeRx, '');
            if (hl) {
                if (!hlcache) {
                    hlcache = msg.hlcache = highlightSync({ fileContents: cleanText, scopeName: 'source.haskell', nbsp: false });
                }
                return (etch.dom("pre", { className: cls, innerHTML: hlcache }));
            }
            else {
                return etch.dom("pre", { className: cls }, cleanText);
            }
        });
    }
}
exports.IdeHaskellReplView = IdeHaskellReplView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBYSxVQUFxQyxFQUFFLEtBQWlCO1FBQ25FLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDeEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7UUFFNUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGlCQUFVLENBQUM7WUFDM0IsdUJBQXVCLEVBQUUsS0FBSztZQUM5QixXQUFXLEVBQUUsSUFBSTtZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQztTQUM3RCxDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFrQjtZQUNuRCxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7b0JBQ3BDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7d0JBQUMsSUFB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RUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDUCxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQ2IsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUE7Z0JBQzVHLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLENBQ0wsa0JBQUssU0FBUyxFQUFFLEdBQUcsRUFDakIsU0FBUyxFQUFFLE9BQU8sR0FDZCxDQUNQLENBQUE7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDLGtCQUFLLFNBQVMsRUFBRSxHQUFHLElBQUcsU0FBUyxDQUFPLENBQUE7WUFDL0MsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBbk1ELGdEQW1NQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbXBvc2l0ZURpc3Bvc2FibGUsXG4gIFRleHRFZGl0b3IsXG59IGZyb20gJ2F0b20nXG5pbXBvcnQgaGlnaGxpZ2h0U3luYyA9IHJlcXVpcmUoJ2F0b20taGlnaGxpZ2h0JylcbmltcG9ydCBldGNoID0gcmVxdWlyZSgnZXRjaCcpXG5cbmltcG9ydCB7XG4gIElDb250ZW50SXRlbSxcbiAgSWRlSGFza2VsbFJlcGxCYXNlLFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuLi9pZGUtaGFza2VsbC1yZXBsLWJhc2UnXG5pbXBvcnQge0J1dHRvbn0gZnJvbSAnLi9idXR0b24nXG5pbXBvcnQge0VkaXRvcn0gZnJvbSAnLi9lZGl0b3InXG5cbmV4cG9ydCB7SVZpZXdTdGF0ZSwgSUNvbnRlbnRJdGVtfVxuXG5jb25zdCB0ZXJtRXNjYXBlUnggPSAvXFx4MUJcXFsoWzAtOV17MSwyfSg7WzAtOV17MSwyfSk/KT9bbXxLXS9nXG5cbmludGVyZmFjZSBJVmlld1N0YXRlT3V0cHV0IGV4dGVuZHMgSVZpZXdTdGF0ZSB7XG4gIGRlc2VyaWFsaXplcjogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBJZGVIYXNrZWxsUmVwbFZpZXcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZC1jbGFzcy1wcm9wZXJ0aWVzXG4gIHB1YmxpYyByZWZzOiB7XG4gICAgb3V0cHV0OiBIVE1MRWxlbWVudFxuICAgIGVkaXRvcjogRWRpdG9yXG4gIH1cbiAgcHVibGljIGVkaXRvcjogVGV4dEVkaXRvclxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZC1jbGFzcy1wcm9wZXJ0aWVzXG4gIHByaXZhdGUgb3V0cHV0Rm9udEZhbWlseTogc3RyaW5nXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBvdXRwdXRGb250U2l6ZTogc3RyaW5nXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2U6IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4sIHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gICAgc3VwZXIodXBpUHJvbWlzZSwgc3RhdGUpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICAgIHRoaXMuZWRpdG9yID0gbmV3IFRleHRFZGl0b3Ioe1xuICAgICAgbGluZU51bWJlckd1dHRlclZpc2libGU6IGZhbHNlLFxuICAgICAgc29mdFdyYXBwZWQ6IHRydWUsXG4gICAgICBncmFtbWFyOiBhdG9tLmdyYW1tYXJzLmdyYW1tYXJGb3JTY29wZU5hbWUoJ3NvdXJjZS5oYXNrZWxsJyksXG4gICAgfSlcblxuICAgIGF0b20udGV4dEVkaXRvcnMuYWRkKHRoaXMuZWRpdG9yKVxuXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoXG4gICAgICBhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMoKGVkaXRvcjogVGV4dEVkaXRvcikgPT4ge1xuICAgICAgICBpZiAoZWRpdG9yLmdldFBhdGgoKSA9PT0gdGhpcy51cmkpIHtcbiAgICAgICAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRTYXZlKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmF1dG9SZWxvYWRSZXBlYXQpIHsgdGhpcy5naGNpUmVsb2FkUmVwZWF0KCkgfVxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRTaXplJywgKGZvbnRTaXplOiBudW1iZXIpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udFNpemUgPSBgJHtmb250U2l6ZX1weGBcbiAgICB9KSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udEZhbWlseScsIChmb250RmFtaWx5OiBzdHJpbmcpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udEZhbWlseSA9IGZvbnRGYW1pbHlcbiAgICB9KSlcblxuICAgIGV0Y2guaW5pdGlhbGl6ZSh0aGlzKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWNDb21tYW5kICgpIHtcbiAgICBjb25zdCBpbnAgPSB0aGlzLmVkaXRvci5nZXRCdWZmZXIoKS5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KCcnKVxuICAgIHRoaXMuaGlzdG9yeS5zYXZlKGlucClcbiAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGlucClcbiAgfVxuXG4gIHB1YmxpYyBjb3B5VGV4dCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dChjb21tYW5kKVxuICAgIHRoaXMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlCYWNrICgpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5lZGl0b3IuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29CYWNrKGN1cnJlbnQpKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlGb3J3YXJkICgpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0ZvcndhcmQoKSlcbiAgfVxuXG4gIHB1YmxpYyBjbGVhciAoKSB7XG4gICAgdGhpcy5tZXNzYWdlcyA9IFtdXG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldFVSSSAoKSB7XG4gICAgcmV0dXJuIGBpZGUtaGFza2VsbDovL3JlcGwvJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgZ2V0VGl0bGUgKCkge1xuICAgIHJldHVybiBgUkVQTDogJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgZXRjaC5kZXN0cm95KHRoaXMpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgICBzdXBlci5kZXN0cm95KClcbiAgfVxuXG4gIHB1YmxpYyBzZXJpYWxpemUgKCk6IElWaWV3U3RhdGVPdXRwdXQge1xuICAgIHJldHVybiB7XG4gICAgICBkZXNlcmlhbGl6ZXI6ICdJZGVIYXNrZWxsUmVwbFZpZXcnLFxuICAgICAgdXJpOiB0aGlzLnVyaSxcbiAgICAgIGNvbnRlbnQ6IHRoaXMubWVzc2FnZXMsXG4gICAgICBoaXN0b3J5OiB0aGlzLmhpc3Rvcnkuc2VyaWFsaXplKCksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0OiB0aGlzLmF1dG9SZWxvYWRSZXBlYXQsXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSAoKSB7XG4gICAgY29uc3QgYXRFbmQgPSAhIXRoaXMucmVmcyAmJlxuICAgICAgKHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wICsgdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHQgPj0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQpXG4gICAgY29uc3QgZm9jdXNlZCA9ICEhdGhpcy5yZWZzICYmICEhZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJlxuICAgICAgKHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSlcbiAgICBhd2FpdCBldGNoLnVwZGF0ZSh0aGlzKVxuICAgIGlmIChhdEVuZCkge1xuICAgICAgdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgPSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodCAtIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0XG4gICAgfVxuICAgIGlmIChmb2N1c2VkKSB7XG4gICAgICB0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGxcIj5cbiAgICAgICAgPGRpdiByZWY9XCJvdXRwdXRcIiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLW91dHB1dCBuYXRpdmUta2V5LWJpbmRpbmdzXCIgdGFiSW5kZXg9XCItMVwiXG4gICAgICAgICAgc3R5bGU9e3tmb250U2l6ZTogdGhpcy5vdXRwdXRGb250U2l6ZSwgZm9udEZhbWlseTogdGhpcy5vdXRwdXRGb250RmFtaWx5fX0+XG4gICAgICAgICAge3RoaXMucmVuZGVyT3V0cHV0KCl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7dGhpcy5yZW5kZXJFcnJEaXYoKX1cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJidXR0b24tY29udGFpbmVyXCI+XG4gICAgICAgICAge3RoaXMucmVuZGVyUHJvbXB0KCl9XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwicmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiUmVsb2FkIGZpbGUgYW5kIHJlcGVhdCBsYXN0IGNvbW1hbmRcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJhdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlRvZ2dsZSByZWxvYWQtcmVwZWF0IG9uIGZpbGUgc2F2ZVwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHN0YXRlPXt0aGlzLmF1dG9SZWxvYWRSZXBlYXR9XG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJpbnRlcnJ1cHRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkludGVycnVwdCBjdXJyZW50IGNvbXB1dGF0aW9uXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImNsZWFyXCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJDbGVhciBvdXRwdXRcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Y2xlYXItb3V0cHV0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVkaXRvclwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZWRpdG9yLWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgPEVkaXRvciByZWY9XCJlZGl0b3JcIiBlbGVtZW50PXt0aGlzLmVkaXRvci5lbGVtZW50fSAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5sb2FkKHRoaXMudXJpKVxuICAgIHRoaXMucHJvbXB0ID0gcmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVyciAocmVzLnN0ZGVycilcbiAgICByZXR1cm4gc3VwZXIub25Jbml0aWFsTG9hZCgpXG4gIH1cblxuICBwcml2YXRlIHJlbmRlckVyckRpdiAoKSB7XG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVycm9yXCI+XG4gICAgICAgICAge3RoaXMuZXJyb3JzIC8qVE9ETyByZW5kZXIqL31cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJQcm9tcHQgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzPVwicmVwbC1wcm9tcHRcIj57dGhpcy5wcm9tcHQgfHwgJyd9Jmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0ICgpIHtcbiAgICBjb25zdCBtYXhNc2cgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwubWF4TWVzc2FnZXMnKVxuICAgIGlmIChtYXhNc2cgPiAwKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzID0gdGhpcy5tZXNzYWdlcy5zbGljZSgtbWF4TXNnKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlcy5tYXAoKG1zZzogSUNvbnRlbnRJdGVtKSA9PiB7XG4gICAgICBjb25zdCB7dGV4dCwgY2xzLCBobH0gPSBtc2dcbiAgICAgIGxldCB7aGxjYWNoZX0gPSBtc2dcbiAgICAgIGNvbnN0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSh0ZXJtRXNjYXBlUngsICcnKVxuICAgICAgaWYgKGhsKSB7XG4gICAgICAgIGlmICghaGxjYWNoZSkge1xuICAgICAgICAgIGhsY2FjaGUgPSBtc2cuaGxjYWNoZSA9IGhpZ2hsaWdodFN5bmMoe2ZpbGVDb250ZW50czogY2xlYW5UZXh0LCBzY29wZU5hbWU6ICdzb3VyY2UuaGFza2VsbCcsIG5ic3A6IGZhbHNlfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwcmUgY2xhc3NOYW1lPXtjbHN9XG4gICAgICAgICAgICBpbm5lckhUTUw9e2hsY2FjaGV9PlxuICAgICAgICAgIDwvcHJlPlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPHByZSBjbGFzc05hbWU9e2Nsc30+e2NsZWFuVGV4dH08L3ByZT5cbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iXX0=