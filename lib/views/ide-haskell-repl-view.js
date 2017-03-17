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
        etch.initialize(this);
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
    historyBack() {
        let current = this.editor.getText();
        this.editor.setText(this.history.goBack(current));
    }
    historyForward() {
        this.editor.setText(this.history.goForward());
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
            let atEnd = !!this.refs &&
                (this.refs.output.scrollTop + this.refs.output.clientHeight >= this.refs.output.scrollHeight);
            let focused = !!this.refs && !!document.activeElement &&
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
            this.renderPrompt(),
            etch.dom("div", { className: "ide-haskell-repl-editor" },
                etch.dom("div", { className: "editor-container" },
                    etch.dom(editor_1.Editor, { ref: "editor", element: this.editor.element })),
                etch.dom(button_1.Button, { cls: "reload-repeat", tooltip: "Reload file and repeat last command", command: "ide-haskell-repl:reload-repeat", parent: this }),
                etch.dom(button_1.Button, { cls: "auto-reload-repeat", tooltip: "Toggle reload-repeat on file save", command: "ide-haskell-repl:toggle-auto-reload-repeat", state: this.autoReloadRepeat, parent: this }),
                etch.dom(button_1.Button, { cls: "interrupt", tooltip: "Interrupt current computation", command: "ide-haskell-repl:ghci-interrupt", parent: this }))));
    }
    onInitialLoad() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.ghci.load(this.uri);
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
        return (etch.dom("div", null,
            this.prompt || '',
            ">"));
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
}
exports.IdeHaskellReplView = IdeHaskellReplView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFNeEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU07WUFDdkMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO29CQUNwQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO3dCQUFDLElBQUks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O1FBQ2xCLE1BQU0sQ0FBQyxDQUNMO1lBQU0sSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFO2dCQUFXLENBQ25DLENBQUE7SUFDSCxDQUFDO0lBRU8sWUFBWTtRQUNsQixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFlO1lBQ3JELElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBQzlDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsTUFBTSxDQUFDLENBQ0wsa0JBQUssU0FBUyxFQUFFLEdBQUcsRUFDakIsU0FBUyxFQUFFLGFBQWEsQ0FBQyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUMsQ0FBQyxHQUN6RixDQUNQLENBQUE7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDLGtCQUFLLFNBQVMsRUFBRSxHQUFHLElBQUcsU0FBUyxDQUFPLENBQUE7WUFDL0MsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBeEtELGdEQXdLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbXBvc2l0ZURpc3Bvc2FibGUsXG4gIFRleHRFZGl0b3IsXG59IGZyb20gJ2F0b20nXG5pbXBvcnQgaGlnaGxpZ2h0U3luYyA9IHJlcXVpcmUoJ2F0b20taGlnaGxpZ2h0JylcbmltcG9ydCBldGNoID0gcmVxdWlyZSgnZXRjaCcpXG5cbmltcG9ydCB7XG4gIElDb250ZW50SXRlbSxcbiAgSWRlSGFza2VsbFJlcGxCYXNlLFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuLi9pZGUtaGFza2VsbC1yZXBsLWJhc2UnXG5pbXBvcnQge0J1dHRvbn0gZnJvbSAnLi9idXR0b24nXG5pbXBvcnQge0VkaXRvcn0gZnJvbSAnLi9lZGl0b3InXG5cbmV4cG9ydCB7SVZpZXdTdGF0ZSwgSUNvbnRlbnRJdGVtfVxuXG5jb25zdCB0ZXJtRXNjYXBlUnggPSAvXFx4MUJcXFsoWzAtOV17MSwyfSg7WzAtOV17MSwyfSk/KT9bbXxLXS9nXG5cbmludGVyZmFjZSBJVmlld1N0YXRlT3V0cHV0IGV4dGVuZHMgSVZpZXdTdGF0ZSB7XG4gIGRlc2VyaWFsaXplcjogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBJZGVIYXNrZWxsUmVwbFZpZXcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwdWJsaWMgcmVmczoge1trZXk6IHN0cmluZ106IGFueX1cbiAgcHVibGljIGVkaXRvcjogVGV4dEVkaXRvclxuICBwcml2YXRlIG91dHB1dEZvbnRGYW1pbHk6IGFueVxuICBwcml2YXRlIG91dHB1dEZvbnRTaXplOiBhbnlcbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZSwgc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgICBzdXBlcih1cGlQcm9taXNlLCBzdGF0ZSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gICAgdGhpcy5lZGl0b3IgPSBuZXcgVGV4dEVkaXRvcih7XG4gICAgICBsaW5lTnVtYmVyR3V0dGVyVmlzaWJsZTogZmFsc2UsXG4gICAgICBzb2Z0V3JhcHBlZDogdHJ1ZSxcbiAgICAgIGdyYW1tYXI6IGF0b20uZ3JhbW1hcnMuZ3JhbW1hckZvclNjb3BlTmFtZSgnc291cmNlLmhhc2tlbGwnKSxcbiAgICB9KVxuXG4gICAgYXRvbS50ZXh0RWRpdG9ycy5hZGQodGhpcy5lZGl0b3IpXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0VVJJKCkgPT09IHRoaXMudXJpKSB7XG4gICAgICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkU2F2ZSgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZSkgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YFxuICAgIH0pKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250RmFtaWx5JywgKGZvbnRGYW1pbHkpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udEZhbWlseSA9IGZvbnRGYW1pbHlcbiAgICB9KSlcblxuICAgIGV0Y2guaW5pdGlhbGl6ZSh0aGlzKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWNDb21tYW5kICgpIHtcbiAgICBsZXQgaW5wID0gdGhpcy5lZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCgnJylcbiAgICB0aGlzLmhpc3Rvcnkuc2F2ZShpbnApXG4gICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChpbnApXG4gIH1cblxuICBwdWJsaWMgY29weVRleHQgKGNvbW1hbmQpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KGNvbW1hbmQpXG4gICAgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUJhY2sgKCkge1xuICAgIGxldCBjdXJyZW50ID0gdGhpcy5lZGl0b3IuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29CYWNrKGN1cnJlbnQpKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlGb3J3YXJkICgpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0ZvcndhcmQoKSlcbiAgfVxuXG4gIHB1YmxpYyBnZXRVUkkgKCkge1xuICAgIHJldHVybiBgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGdldFRpdGxlICgpIHtcbiAgICByZXR1cm4gYFJFUEw6ICR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gICAgc3VwZXIuZGVzdHJveSgpXG4gIH1cblxuICBwdWJsaWMgc2VyaWFsaXplICgpOiBJVmlld1N0YXRlT3V0cHV0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzZXJpYWxpemVyOiAnSWRlSGFza2VsbFJlcGxWaWV3JyxcbiAgICAgIHVyaTogdGhpcy51cmksXG4gICAgICBjb250ZW50OiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgaGlzdG9yeTogdGhpcy5oaXN0b3J5LnNlcmlhbGl6ZSgpLFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogdGhpcy5hdXRvUmVsb2FkUmVwZWF0LFxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKCkge1xuICAgIGxldCBhdEVuZCA9ICEhdGhpcy5yZWZzICYmXG4gICAgICAodGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgKyB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodCA+PSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodClcbiAgICBsZXQgZm9jdXNlZCA9ICEhdGhpcy5yZWZzICYmICEhZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJlxuICAgICAgKHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSlcbiAgICBhd2FpdCBldGNoLnVwZGF0ZSh0aGlzKVxuICAgIGlmIChhdEVuZCkge1xuICAgICAgdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgPSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodCAtIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0XG4gICAgfVxuICAgIGlmIChmb2N1c2VkKSB7XG4gICAgICB0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGxcIj5cbiAgICAgICAgPGRpdiByZWY9XCJvdXRwdXRcIiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLW91dHB1dCBuYXRpdmUta2V5LWJpbmRpbmdzXCIgdGFiSW5kZXg9XCItMVwiXG4gICAgICAgICAgc3R5bGU9e3tmb250U2l6ZTogdGhpcy5vdXRwdXRGb250U2l6ZSwgZm9udEZhbWlseTogdGhpcy5vdXRwdXRGb250RmFtaWx5fX0+XG4gICAgICAgICAge3RoaXMucmVuZGVyT3V0cHV0KCl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7dGhpcy5yZW5kZXJFcnJEaXYoKX1cbiAgICAgICAge3RoaXMucmVuZGVyUHJvbXB0KCl9XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lZGl0b3JcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImVkaXRvci1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxFZGl0b3IgcmVmPVwiZWRpdG9yXCIgZWxlbWVudD17dGhpcy5lZGl0b3IuZWxlbWVudH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIGxldCByZXMgPSBhd2FpdCB0aGlzLmdoY2kubG9hZCh0aGlzLnVyaSlcbiAgICB0aGlzLnByb21wdCA9IHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIgKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHN1cGVyLm9uSW5pdGlhbExvYWQoKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJFcnJEaXYgKCkge1xuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lcnJvclwiPlxuICAgICAgICAgIHt0aGlzLmVycm9ycyAvKlRPRE8gcmVuZGVyKi99XG4gICAgICAgIDwvZGl2PlxuICAgICAgKVxuICAgIH0gZWxzZSB7IHJldHVybiBudWxsIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyUHJvbXB0ICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdj57dGhpcy5wcm9tcHQgfHwgJyd9Jmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlcy5tYXAoKHt0ZXh0LCBjbHMsIGhsfTogSUNvbnRlbnRJdGVtKSA9PiB7XG4gICAgICBsZXQgY2xlYW5UZXh0ID0gdGV4dC5yZXBsYWNlKHRlcm1Fc2NhcGVSeCwgJycpXG4gICAgICBpZiAoaGwpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cHJlIGNsYXNzTmFtZT17Y2xzfVxuICAgICAgICAgICAgaW5uZXJIVE1MPXtoaWdobGlnaHRTeW5jKHtmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZX0pfSA+XG4gICAgICAgICAgPC9wcmU+XG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiA8cHJlIGNsYXNzTmFtZT17Y2xzfT57Y2xlYW5UZXh0fTwvcHJlPlxuICAgICAgfVxuICAgIH0pXG4gIH1cbn1cbiJdfQ==