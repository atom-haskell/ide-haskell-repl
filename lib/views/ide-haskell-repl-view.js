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
            return (etch.dom("div", { className: "ide-haskell-repl-error" }, this.renderErrors()));
        }
        else {
            return null;
        }
    }
    renderErrors() {
        return this.errors.map(err => this.renderError(err));
    }
    renderError(error) {
        const pos = error.position ? atom_1.Point.fromObject(error.position) : undefined;
        const uri = error.uri || '<interactive>';
        const positionText = pos
            ? `${uri}: ${pos.row + 1}, ${pos.column + 1}`
            : uri;
        const context = error.context || '';
        return (etch.dom("div", null,
            positionText,
            ": ",
            error.severity,
            ": ",
            context,
            error.message));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUlhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFLaUM7QUFDakMscUNBQWlDO0FBQ2pDLHFDQUFpQztBQUlqQyxNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQVE5RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBbUIsS0FBYTtRQUM5QixLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFEbkIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO1lBQzNDLHVCQUF1QixFQUFFLEtBQUs7WUFDOUIsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUE7UUFFM0UsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRWpDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUNsQixJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBa0IsRUFBRSxFQUFFO1lBQ3ZELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFH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QUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUE7WUFDN0IsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLEdBQUcsQ0FBQTtZQUNyQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQTtZQUNoRCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNQLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDYixPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtnQkFDOUcsQ0FBQztnQkFDRCxNQUFNLENBQUMsQ0FDTCxrQkFBSyxTQUFTLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxPQUFPLEdBQUksQ0FDNUMsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsa0JBQUssU0FBUyxFQUFFLEdBQUcsSUFBRyxTQUFTLENBQU8sQ0FBQTtZQUMvQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUFsT0QsZ0RBa09DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgVGV4dEVkaXRvcixcbiAgUG9pbnQsXG59IGZyb20gJ2F0b20nXG5pbXBvcnQgaGlnaGxpZ2h0U3luYyA9IHJlcXVpcmUoJ2F0b20taGlnaGxpZ2h0JylcbmltcG9ydCBldGNoID0gcmVxdWlyZSgnZXRjaCcpXG5cbmltcG9ydCB7XG4gIElDb250ZW50SXRlbSxcbiAgSWRlSGFza2VsbFJlcGxCYXNlLFxuICBJVmlld1N0YXRlLFxuICBJRXJyb3JJdGVtLFxufSBmcm9tICcuLi9pZGUtaGFza2VsbC1yZXBsLWJhc2UnXG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuL2J1dHRvbidcbmltcG9ydCB7IEVkaXRvciB9IGZyb20gJy4vZWRpdG9yJ1xuXG5leHBvcnQgeyBJVmlld1N0YXRlLCBJQ29udGVudEl0ZW0gfVxuXG5jb25zdCB0ZXJtRXNjYXBlUnggPSAvXFx4MUJcXFsoWzAtOV17MSwyfSg7WzAtOV17MSwyfSk/KT9bbXxLXS9nXG5cbmludGVyZmFjZSBJVmlld1N0YXRlT3V0cHV0IGV4dGVuZHMgSVZpZXdTdGF0ZSB7XG4gIGRlc2VyaWFsaXplcjogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIGV4dGVuZHMgSlNYLlByb3BzIHsgdXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwgc3RhdGU6IElWaWV3U3RhdGUgfVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxWaWV3IGV4dGVuZHMgSWRlSGFza2VsbFJlcGxCYXNlIGltcGxlbWVudHMgSlNYLkVsZW1lbnRDbGFzcyB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkXG4gIHB1YmxpYyByZWZzOiB7XG4gICAgb3V0cHV0OiBIVE1MRWxlbWVudFxuICAgIGVkaXRvcjogRWRpdG9yXG4gIH1cbiAgcHVibGljIGVkaXRvcjogVGV4dEVkaXRvclxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIG91dHB1dEZvbnRGYW1pbHk6IHN0cmluZ1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIG91dHB1dEZvbnRTaXplOiBzdHJpbmdcbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuICBjb25zdHJ1Y3RvcihwdWJsaWMgcHJvcHM6IElQcm9wcykge1xuICAgIHN1cGVyKHByb3BzLnVwaVByb21pc2UsIHByb3BzLnN0YXRlKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgICB0aGlzLmVkaXRvciA9IGF0b20ud29ya3NwYWNlLmJ1aWxkVGV4dEVkaXRvcih7XG4gICAgICBsaW5lTnVtYmVyR3V0dGVyVmlzaWJsZTogZmFsc2UsXG4gICAgICBzb2Z0V3JhcHBlZDogdHJ1ZSxcbiAgICB9KVxuICAgIHRoaXMuZWRpdG9yLnNldEdyYW1tYXIoYXRvbS5ncmFtbWFycy5ncmFtbWFyRm9yU2NvcGVOYW1lKCdzb3VyY2UuaGFza2VsbCcpKVxuXG4gICAgYXRvbS50ZXh0RWRpdG9ycy5hZGQodGhpcy5lZGl0b3IpXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yOiBUZXh0RWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0UGF0aCgpID09PSB0aGlzLnVyaSkge1xuICAgICAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZFNhdmUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0b1JlbG9hZFJlcGVhdCkgeyB0aGlzLmdoY2lSZWxvYWRSZXBlYXQoKSB9XG4gICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udFNpemUnLCAoZm9udFNpemU6IG51bWJlcikgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YFxuICAgIH0pKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250RmFtaWx5JywgKGZvbnRGYW1pbHk6IHN0cmluZykgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250RmFtaWx5ID0gZm9udEZhbWlseVxuICAgIH0pKVxuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZXhlY0NvbW1hbmQoKSB7XG4gICAgY29uc3QgaW5wID0gdGhpcy5lZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCgnJylcbiAgICBpZiAodGhpcy5naGNpICYmIHRoaXMuZ2hjaS5pc0J1c3koKSkge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHsgdGV4dDogaW5wLCBobDogZmFsc2UsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCcgfSlcbiAgICAgIHRoaXMuZ2hjaS53cml0ZVJhdyhpbnApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaGlzdG9yeS5zYXZlKGlucClcbiAgICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoaW5wKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBjb3B5VGV4dChjb21tYW5kOiBzdHJpbmcpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KGNvbW1hbmQpXG4gICAgYXRvbS52aWV3cy5nZXRWaWV3KHRoaXMuZWRpdG9yKS5mb2N1cygpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUJhY2soKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuZWRpdG9yLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvQmFjayhjdXJyZW50KSlcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5Rm9yd2FyZCgpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0ZvcndhcmQoKSlcbiAgfVxuXG4gIHB1YmxpYyBjbGVhcigpIHtcbiAgICB0aGlzLm1lc3NhZ2VzID0gW11cbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0VVJJKCkge1xuICAgIHJldHVybiBgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGdldFRpdGxlKCkge1xuICAgIHJldHVybiBgUkVQTDogJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSgpIHtcbiAgICBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIHNlcmlhbGl6ZSgpOiBJVmlld1N0YXRlT3V0cHV0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzZXJpYWxpemVyOiAnSWRlSGFza2VsbFJlcGxWaWV3JyxcbiAgICAgIHVyaTogdGhpcy51cmksXG4gICAgICBjb250ZW50OiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgaGlzdG9yeTogdGhpcy5oaXN0b3J5LnNlcmlhbGl6ZSgpLFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogdGhpcy5hdXRvUmVsb2FkUmVwZWF0LFxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUoKSB7XG4gICAgY29uc3QgYXRFbmQgPSAhIXRoaXMucmVmcyAmJlxuICAgICAgKHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wICsgdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHQgPj0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQpXG4gICAgY29uc3QgZm9jdXNlZCA9ICEhdGhpcy5yZWZzICYmICEhZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJlxuICAgICAgKHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSlcbiAgICBhd2FpdCBldGNoLnVwZGF0ZSh0aGlzKVxuICAgIGlmIChhdEVuZCkge1xuICAgICAgdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgPSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodCAtIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0XG4gICAgfVxuICAgIGlmIChmb2N1c2VkKSB7XG4gICAgICB0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgcmVmPVwib3V0cHV0XCJcbiAgICAgICAgICBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLW91dHB1dCBuYXRpdmUta2V5LWJpbmRpbmdzXCJcbiAgICAgICAgICB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogdGhpcy5vdXRwdXRGb250U2l6ZSwgZm9udEZhbWlseTogdGhpcy5vdXRwdXRGb250RmFtaWx5IH19XG4gICAgICAgID5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJ1dHRvbi1jb250YWluZXJcIj5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc31cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc31cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiY2xlYXJcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkNsZWFyIG91dHB1dFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZWRpdG9yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8RWRpdG9yIHJlZj1cImVkaXRvclwiIGVsZW1lbnQ9e2F0b20udmlld3MuZ2V0Vmlldyh0aGlzLmVkaXRvcil9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kubG9hZCh0aGlzLnVyaSlcbiAgICB0aGlzLnByb21wdCA9IHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIocmVzLnN0ZGVycilcbiAgICByZXR1cm4gc3VwZXIub25Jbml0aWFsTG9hZCgpXG4gIH1cblxuICBwcml2YXRlIHJlbmRlckVyckRpdigpIHtcbiAgICBpZiAoIXRoaXMudXBpKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZXJyb3JcIj5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJFcnJvcnMoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfSAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOiBuby1udWxsLWtleXdvcmRcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyb3JzKCkge1xuICAgIHJldHVybiB0aGlzLmVycm9ycy5tYXAoZXJyID0+IHRoaXMucmVuZGVyRXJyb3IoZXJyKSlcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyb3IoZXJyb3I6IElFcnJvckl0ZW0pIHtcbiAgICBjb25zdCBwb3MgPSBlcnJvci5wb3NpdGlvbiA/IFBvaW50LmZyb21PYmplY3QoZXJyb3IucG9zaXRpb24pIDogdW5kZWZpbmVkXG4gICAgY29uc3QgdXJpID0gZXJyb3IudXJpIHx8ICc8aW50ZXJhY3RpdmU+J1xuICAgIGNvbnN0IHBvc2l0aW9uVGV4dCA9XG4gICAgICAgIHBvc1xuICAgICAgICAgID8gYCR7dXJpfTogJHtwb3Mucm93ICsgMX0sICR7cG9zLmNvbHVtbiArIDF9YFxuICAgICAgICAgIDogdXJpXG4gICAgY29uc3QgY29udGV4dCA9IGVycm9yLmNvbnRleHQgfHwgJydcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdj5cbiAgICAgICAge3Bvc2l0aW9uVGV4dH06IHtlcnJvci5zZXZlcml0eX06IHtjb250ZXh0fVxuICAgICAgICB7ZXJyb3IubWVzc2FnZX1cbiAgICAgIDwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyUHJvbXB0KCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzPVwicmVwbC1wcm9tcHRcIj57dGhpcy5wcm9tcHQgfHwgJyd9Jmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0KCkge1xuICAgIGNvbnN0IG1heE1zZyA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5tYXhNZXNzYWdlcycpXG4gICAgaWYgKG1heE1zZyA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzLnNsaWNlKC1tYXhNc2cpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzLm1hcCgobXNnOiBJQ29udGVudEl0ZW0pID0+IHtcbiAgICAgIGNvbnN0IHsgdGV4dCwgY2xzLCBobCB9ID0gbXNnXG4gICAgICBsZXQgeyBobGNhY2hlIH0gPSBtc2dcbiAgICAgIGNvbnN0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSh0ZXJtRXNjYXBlUngsICcnKVxuICAgICAgaWYgKGhsKSB7XG4gICAgICAgIGlmICghaGxjYWNoZSkge1xuICAgICAgICAgIGhsY2FjaGUgPSBtc2cuaGxjYWNoZSA9IGhpZ2hsaWdodFN5bmMoeyBmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPHByZSBjbGFzc05hbWU9e2Nsc30gaW5uZXJIVE1MPXtobGNhY2hlfSAvPlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPHByZSBjbGFzc05hbWU9e2Nsc30+e2NsZWFuVGV4dH08L3ByZT5cbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iXX0=