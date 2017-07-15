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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBYSxVQUFxQyxFQUFFLEtBQWlCO1FBQ25FLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUE7UUFDeEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7UUFFNUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGlCQUFVLENBQUM7WUFDM0IsdUJBQXVCLEVBQUUsS0FBSztZQUM5QixXQUFXLEVBQUUsSUFBSTtZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQztTQUM3RCxDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7UUFFakMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFrQjtZQUNuRCxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7b0JBQ3BDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7d0JBQUMsSUFB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Q0FBQyxDQUFDO2dCQUNQLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDYixPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQTtnQkFDNUcsQ0FBQztnQkFDRCxNQUFNLENBQUMsQ0FDTCxrQkFBSyxTQUFTLEVBQUUsR0FBRyxFQUNqQixTQUFTLEVBQUUsT0FBTyxHQUNkLENBQ1AsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsa0JBQUssU0FBUyxFQUFFLEdBQUcsSUFBRyxTQUFTLENBQU8sQ0FBQTtZQUMvQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUFuTUQsZ0RBbU1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgVGV4dEVkaXRvcixcbn0gZnJvbSAnYXRvbSdcbmltcG9ydCBoaWdobGlnaHRTeW5jID0gcmVxdWlyZSgnYXRvbS1oaWdobGlnaHQnKVxuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4uL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7QnV0dG9ufSBmcm9tICcuL2J1dHRvbidcbmltcG9ydCB7RWRpdG9yfSBmcm9tICcuL2VkaXRvcidcblxuZXhwb3J0IHtJVmlld1N0YXRlLCBJQ29udGVudEl0ZW19XG5cbmNvbnN0IHRlcm1Fc2NhcGVSeCA9IC9cXHgxQlxcWyhbMC05XXsxLDJ9KDtbMC05XXsxLDJ9KT8pP1ttfEtdL2dcblxuaW50ZXJmYWNlIElWaWV3U3RhdGVPdXRwdXQgZXh0ZW5kcyBJVmlld1N0YXRlIHtcbiAgZGVzZXJpYWxpemVyOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsVmlldyBleHRlbmRzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHVibGljIHJlZnM6IHtcbiAgICBvdXRwdXQ6IEhUTUxFbGVtZW50XG4gICAgZWRpdG9yOiBFZGl0b3JcbiAgfVxuICBwdWJsaWMgZWRpdG9yOiBUZXh0RWRpdG9yXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBvdXRwdXRGb250RmFtaWx5OiBzdHJpbmdcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwcml2YXRlIG91dHB1dEZvbnRTaXplOiBzdHJpbmdcbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwgc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgICBzdXBlcih1cGlQcm9taXNlLCBzdGF0ZSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gICAgdGhpcy5lZGl0b3IgPSBuZXcgVGV4dEVkaXRvcih7XG4gICAgICBsaW5lTnVtYmVyR3V0dGVyVmlzaWJsZTogZmFsc2UsXG4gICAgICBzb2Z0V3JhcHBlZDogdHJ1ZSxcbiAgICAgIGdyYW1tYXI6IGF0b20uZ3JhbW1hcnMuZ3JhbW1hckZvclNjb3BlTmFtZSgnc291cmNlLmhhc2tlbGwnKSxcbiAgICB9KVxuXG4gICAgYXRvbS50ZXh0RWRpdG9ycy5hZGQodGhpcy5lZGl0b3IpXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yOiBUZXh0RWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0UGF0aCgpID09PSB0aGlzLnVyaSkge1xuICAgICAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZFNhdmUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0b1JlbG9hZFJlcGVhdCkgeyB0aGlzLmdoY2lSZWxvYWRSZXBlYXQoKSB9XG4gICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udFNpemUnLCAoZm9udFNpemU6IG51bWJlcikgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YFxuICAgIH0pKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250RmFtaWx5JywgKGZvbnRGYW1pbHk6IHN0cmluZykgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250RmFtaWx5ID0gZm9udEZhbWlseVxuICAgIH0pKVxuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZXhlY0NvbW1hbmQgKCkge1xuICAgIGNvbnN0IGlucCA9IHRoaXMuZWRpdG9yLmdldEJ1ZmZlcigpLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoJycpXG4gICAgdGhpcy5oaXN0b3J5LnNhdmUoaW5wKVxuICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoaW5wKVxuICB9XG5cbiAgcHVibGljIGNvcHlUZXh0IChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KGNvbW1hbmQpXG4gICAgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUJhY2sgKCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmVkaXRvci5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0JhY2soY3VycmVudCkpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUZvcndhcmQgKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGNsZWFyICgpIHtcbiAgICB0aGlzLm1lc3NhZ2VzID0gW11cbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0VVJJICgpIHtcbiAgICByZXR1cm4gYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBnZXRUaXRsZSAoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIHNlcmlhbGl6ZSAoKTogSVZpZXdTdGF0ZU91dHB1dCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlc2VyaWFsaXplcjogJ0lkZUhhc2tlbGxSZXBsVmlldycsXG4gICAgICB1cmk6IHRoaXMudXJpLFxuICAgICAgY29udGVudDogdGhpcy5tZXNzYWdlcyxcbiAgICAgIGhpc3Rvcnk6IHRoaXMuaGlzdG9yeS5zZXJpYWxpemUoKSxcbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQ6IHRoaXMuYXV0b1JlbG9hZFJlcGVhdCxcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlICgpIHtcbiAgICBjb25zdCBhdEVuZCA9ICEhdGhpcy5yZWZzICYmXG4gICAgICAodGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgKyB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodCA+PSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodClcbiAgICBjb25zdCBmb2N1c2VkID0gISF0aGlzLnJlZnMgJiYgISFkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmXG4gICAgICAodGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKVxuICAgIGF3YWl0IGV0Y2gudXBkYXRlKHRoaXMpXG4gICAgaWYgKGF0RW5kKSB7XG4gICAgICB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCA9IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHRcbiAgICB9XG4gICAgaWYgKGZvY3VzZWQpIHtcbiAgICAgIHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2IHJlZj1cIm91dHB1dFwiIGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtb3V0cHV0IG5hdGl2ZS1rZXktYmluZGluZ3NcIiB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17e2ZvbnRTaXplOiB0aGlzLm91dHB1dEZvbnRTaXplLCBmb250RmFtaWx5OiB0aGlzLm91dHB1dEZvbnRGYW1pbHl9fT5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJ1dHRvbi1jb250YWluZXJcIj5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiY2xlYXJcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkNsZWFyIG91dHB1dFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZWRpdG9yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8RWRpdG9yIHJlZj1cImVkaXRvclwiIGVsZW1lbnQ9e3RoaXMuZWRpdG9yLmVsZW1lbnR9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5naGNpLmxvYWQodGhpcy51cmkpXG4gICAgdGhpcy5wcm9tcHQgPSByZXMucHJvbXB0WzFdXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyIChyZXMuc3RkZXJyKVxuICAgIHJldHVybiBzdXBlci5vbkluaXRpYWxMb2FkKClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyRGl2ICgpIHtcbiAgICBpZiAoIXRoaXMudXBpKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZXJyb3JcIj5cbiAgICAgICAgICB7dGhpcy5lcnJvcnMgLypUT0RPIHJlbmRlciovfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIClcbiAgICB9IGVsc2UgeyByZXR1cm4gbnVsbCB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclByb21wdCAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3M9XCJyZXBsLXByb21wdFwiPnt0aGlzLnByb21wdCB8fCAnJ30mZ3Q7PC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJPdXRwdXQgKCkge1xuICAgIGNvbnN0IG1heE1zZyA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5tYXhNZXNzYWdlcycpXG4gICAgaWYgKG1heE1zZyA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzLnNsaWNlKC1tYXhNc2cpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzLm1hcCgobXNnOiBJQ29udGVudEl0ZW0pID0+IHtcbiAgICAgIGNvbnN0IHt0ZXh0LCBjbHMsIGhsfSA9IG1zZ1xuICAgICAgbGV0IHtobGNhY2hlfSA9IG1zZ1xuICAgICAgY29uc3QgY2xlYW5UZXh0ID0gdGV4dC5yZXBsYWNlKHRlcm1Fc2NhcGVSeCwgJycpXG4gICAgICBpZiAoaGwpIHtcbiAgICAgICAgaWYgKCFobGNhY2hlKSB7XG4gICAgICAgICAgaGxjYWNoZSA9IG1zZy5obGNhY2hlID0gaGlnaGxpZ2h0U3luYyh7ZmlsZUNvbnRlbnRzOiBjbGVhblRleHQsIHNjb3BlTmFtZTogJ3NvdXJjZS5oYXNrZWxsJywgbmJzcDogZmFsc2V9KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHByZSBjbGFzc05hbWU9e2Nsc31cbiAgICAgICAgICAgIGlubmVySFRNTD17aGxjYWNoZX0+XG4gICAgICAgICAgPC9wcmU+XG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiA8cHJlIGNsYXNzTmFtZT17Y2xzfT57Y2xlYW5UZXh0fTwvcHJlPlxuICAgICAgfVxuICAgIH0pXG4gIH1cbn1cbiJdfQ==