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
    constructor(props) {
        super(props.upiPromise, props.state);
        this.props = props;
        this.disposables = new atom_1.CompositeDisposable();
        this.editor = atom.workspace.buildTextEditor({
            lineNumberGutterVisible: false,
            softWrapped: true,
        });
        this.editor.setGrammar(atom.grammars.grammarForScopeName('source.haskell'));
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
            if (this.ghci && this.ghci.isBusy()) {
                this.messages.push({ text: inp, hl: false, cls: 'ide-haskell-repl-input-text' });
                this.ghci.writeRaw(inp);
            }
            else {
                this.history.save(inp);
                return this.runCommand(inp);
            }
        });
    }
    copyText(command) {
        this.editor.setText(command);
        atom.views.getView(this.editor).focus();
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
                    etch.dom(editor_1.Editor, { ref: "editor", element: atom.views.getView(this.editor) })))));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQWlDO0FBQ2pDLHFDQUFpQztBQUlqQyxNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQVE5RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBbUIsS0FBYTtRQUM5QixLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFEbkIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO1lBQzNDLHVCQUF1QixFQUFFLEtBQUs7WUFDOUIsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUE7UUFFM0UsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRWpDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUNsQixJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBa0I7WUFDbkQsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFN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cixcbn0gZnJvbSAnYXRvbSdcbmltcG9ydCBoaWdobGlnaHRTeW5jID0gcmVxdWlyZSgnYXRvbS1oaWdobGlnaHQnKVxuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4uL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4vYnV0dG9uJ1xuaW1wb3J0IHsgRWRpdG9yIH0gZnJvbSAnLi9lZGl0b3InXG5cbmV4cG9ydCB7IElWaWV3U3RhdGUsIElDb250ZW50SXRlbSB9XG5cbmNvbnN0IHRlcm1Fc2NhcGVSeCA9IC9cXHgxQlxcWyhbMC05XXsxLDJ9KDtbMC05XXsxLDJ9KT8pP1ttfEtdL2dcblxuaW50ZXJmYWNlIElWaWV3U3RhdGVPdXRwdXQgZXh0ZW5kcyBJVmlld1N0YXRlIHtcbiAgZGVzZXJpYWxpemVyOiBzdHJpbmdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvcHMgZXh0ZW5kcyBKU1guUHJvcHMgeyB1cGlQcm9taXNlOiBQcm9taXNlPFVQSS5JVVBJSW5zdGFuY2U+LCBzdGF0ZTogSVZpZXdTdGF0ZSB9XG5cbmV4cG9ydCBjbGFzcyBJZGVIYXNrZWxsUmVwbFZpZXcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2UgaW1wbGVtZW50cyBKU1guRWxlbWVudENsYXNzIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHVibGljIHJlZnM6IHtcbiAgICBvdXRwdXQ6IEhUTUxFbGVtZW50XG4gICAgZWRpdG9yOiBFZGl0b3JcbiAgfVxuICBwdWJsaWMgZWRpdG9yOiBUZXh0RWRpdG9yXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkXG4gIHByaXZhdGUgb3V0cHV0Rm9udEZhbWlseTogc3RyaW5nXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkXG4gIHByaXZhdGUgb3V0cHV0Rm9udFNpemU6IHN0cmluZ1xuICBwcml2YXRlIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwcm9wczogSVByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMudXBpUHJvbWlzZSwgcHJvcHMuc3RhdGUpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICAgIHRoaXMuZWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuYnVpbGRUZXh0RWRpdG9yKHtcbiAgICAgIGxpbmVOdW1iZXJHdXR0ZXJWaXNpYmxlOiBmYWxzZSxcbiAgICAgIHNvZnRXcmFwcGVkOiB0cnVlLFxuICAgIH0pXG4gICAgdGhpcy5lZGl0b3Iuc2V0R3JhbW1hcihhdG9tLmdyYW1tYXJzLmdyYW1tYXJGb3JTY29wZU5hbWUoJ3NvdXJjZS5oYXNrZWxsJykpXG5cbiAgICBhdG9tLnRleHRFZGl0b3JzLmFkZCh0aGlzLmVkaXRvcilcblxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgYXRvbS53b3Jrc3BhY2Uub2JzZXJ2ZVRleHRFZGl0b3JzKChlZGl0b3I6IFRleHRFZGl0b3IpID0+IHtcbiAgICAgICAgaWYgKGVkaXRvci5nZXRQYXRoKCkgPT09IHRoaXMudXJpKSB7XG4gICAgICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkU2F2ZSgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZTogbnVtYmVyKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRTaXplID0gYCR7Zm9udFNpemV9cHhgXG4gICAgfSkpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRGYW1pbHknLCAoZm9udEZhbWlseTogc3RyaW5nKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRGYW1pbHkgPSBmb250RmFtaWx5XG4gICAgfSkpXG5cbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCgpIHtcbiAgICBjb25zdCBpbnAgPSB0aGlzLmVkaXRvci5nZXRCdWZmZXIoKS5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KCcnKVxuICAgIGlmICh0aGlzLmdoY2kgJiYgdGhpcy5naGNpLmlzQnVzeSgpKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goeyB0ZXh0OiBpbnAsIGhsOiBmYWxzZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyB9KVxuICAgICAgdGhpcy5naGNpLndyaXRlUmF3KGlucClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oaXN0b3J5LnNhdmUoaW5wKVxuICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChpbnApXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNvcHlUZXh0KGNvbW1hbmQ6IHN0cmluZykge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoY29tbWFuZClcbiAgICBhdG9tLnZpZXdzLmdldFZpZXcodGhpcy5lZGl0b3IpLmZvY3VzKClcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5QmFjaygpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5lZGl0b3IuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29CYWNrKGN1cnJlbnQpKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlGb3J3YXJkKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGNsZWFyKCkge1xuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXRVUkkoKSB7XG4gICAgcmV0dXJuIGBpZGUtaGFza2VsbDovL3JlcGwvJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgZ2V0VGl0bGUoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95KCkge1xuICAgIGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gICAgc3VwZXIuZGVzdHJveSgpXG4gIH1cblxuICBwdWJsaWMgc2VyaWFsaXplKCk6IElWaWV3U3RhdGVPdXRwdXQge1xuICAgIHJldHVybiB7XG4gICAgICBkZXNlcmlhbGl6ZXI6ICdJZGVIYXNrZWxsUmVwbFZpZXcnLFxuICAgICAgdXJpOiB0aGlzLnVyaSxcbiAgICAgIGNvbnRlbnQ6IHRoaXMubWVzc2FnZXMsXG4gICAgICBoaXN0b3J5OiB0aGlzLmhpc3Rvcnkuc2VyaWFsaXplKCksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0OiB0aGlzLmF1dG9SZWxvYWRSZXBlYXQsXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSgpIHtcbiAgICBjb25zdCBhdEVuZCA9ICEhdGhpcy5yZWZzICYmXG4gICAgICAodGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgKyB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodCA+PSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodClcbiAgICBjb25zdCBmb2N1c2VkID0gISF0aGlzLnJlZnMgJiYgISFkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmXG4gICAgICAodGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKVxuICAgIGF3YWl0IGV0Y2gudXBkYXRlKHRoaXMpXG4gICAgaWYgKGF0RW5kKSB7XG4gICAgICB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCA9IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHRcbiAgICB9XG4gICAgaWYgKGZvY3VzZWQpIHtcbiAgICAgIHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmRlcigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsXCI+XG4gICAgICAgIDxkaXZcbiAgICAgICAgICByZWY9XCJvdXRwdXRcIlxuICAgICAgICAgIGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtb3V0cHV0IG5hdGl2ZS1rZXktYmluZGluZ3NcIlxuICAgICAgICAgIHRhYkluZGV4PVwiLTFcIlxuICAgICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiB0aGlzLm91dHB1dEZvbnRTaXplLCBmb250RmFtaWx5OiB0aGlzLm91dHB1dEZvbnRGYW1pbHkgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHt0aGlzLnJlbmRlck91dHB1dCgpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAge3RoaXMucmVuZGVyRXJyRGl2KCl9XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYnV0dG9uLWNvbnRhaW5lclwiPlxuICAgICAgICAgIHt0aGlzLnJlbmRlclByb21wdCgpfVxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cInJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlJlbG9hZCBmaWxlIGFuZCByZXBlYXQgbGFzdCBjb21tYW5kXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJUb2dnbGUgcmVsb2FkLXJlcGVhdCBvbiBmaWxlIHNhdmVcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBzdGF0ZT17dGhpcy5hdXRvUmVsb2FkUmVwZWF0fVxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJJbnRlcnJ1cHQgY3VycmVudCBjb21wdXRhdGlvblwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJjbGVhclwiXG4gICAgICAgICAgICB0b29sdGlwPVwiQ2xlYXIgb3V0cHV0XCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOmNsZWFyLW91dHB1dFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lZGl0b3JcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImVkaXRvci1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxFZGl0b3IgcmVmPVwiZWRpdG9yXCIgZWxlbWVudD17YXRvbS52aWV3cy5nZXRWaWV3KHRoaXMuZWRpdG9yKX0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5sb2FkKHRoaXMudXJpKVxuICAgIHRoaXMucHJvbXB0ID0gcmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiBzdXBlci5vbkluaXRpYWxMb2FkKClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyRGl2KCkge1xuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lcnJvclwiPlxuICAgICAgICAgIHt0aGlzLmVycm9ycy8qVE9ETyByZW5kZXIqL31cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfSAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOiBuby1udWxsLWtleXdvcmRcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyUHJvbXB0KCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzPVwicmVwbC1wcm9tcHRcIj57dGhpcy5wcm9tcHQgfHwgJyd9Jmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0KCkge1xuICAgIGNvbnN0IG1heE1zZyA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5tYXhNZXNzYWdlcycpXG4gICAgaWYgKG1heE1zZyA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzLnNsaWNlKC1tYXhNc2cpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzLm1hcCgobXNnOiBJQ29udGVudEl0ZW0pID0+IHtcbiAgICAgIGNvbnN0IHsgdGV4dCwgY2xzLCBobCB9ID0gbXNnXG4gICAgICBsZXQgeyBobGNhY2hlIH0gPSBtc2dcbiAgICAgIGNvbnN0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSh0ZXJtRXNjYXBlUngsICcnKVxuICAgICAgaWYgKGhsKSB7XG4gICAgICAgIGlmICghaGxjYWNoZSkge1xuICAgICAgICAgIGhsY2FjaGUgPSBtc2cuaGxjYWNoZSA9IGhpZ2hsaWdodFN5bmMoeyBmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHByZSBjbGFzc05hbWU9e2Nsc30gaW5uZXJIVE1MPXtobGNhY2hlfSAvPlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPHByZSBjbGFzc05hbWU9e2Nsc30+e2NsZWFuVGV4dH08L3ByZT5cbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iXX0=