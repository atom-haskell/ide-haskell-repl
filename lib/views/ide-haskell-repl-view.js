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
            yield etch.destroy(this);
            this.disposables.dispose();
            return _super("destroy").call(this);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUlhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFLaUM7QUFDakMscUNBQWlDO0FBQ2pDLHFDQUFpQztBQUlqQyxNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQVM5RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBbUIsS0FBYTtRQUM5QixLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFEbkIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO1lBQzNDLHVCQUF1QixFQUFFLEtBQUs7WUFDOUIsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FBQyxDQUFBO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUE7UUFHM0UsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRWpDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUNsQixJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBa0IsRUFBRSxFQUFFO1lBQ3ZELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFH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QUUsRUFBRTtZQUM3QyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUE7WUFDN0IsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLEdBQUcsQ0FBQTtZQUNyQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQTtZQUNoRCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNQLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDYixPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtnQkFDOUcsQ0FBQztnQkFDRCxNQUFNLENBQUMsQ0FFTCxrQkFBSyxTQUFTLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxPQUFPLEdBQUksQ0FDNUMsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFFTixNQUFNLENBQUMsa0JBQUssU0FBUyxFQUFFLEdBQUcsSUFBRyxTQUFTLENBQU8sQ0FBQTtZQUMvQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUE5T0QsZ0RBOE9DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgVGV4dEVkaXRvcixcbiAgUG9pbnQsXG59IGZyb20gJ2F0b20nXG5pbXBvcnQgaGlnaGxpZ2h0U3luYyA9IHJlcXVpcmUoJ2F0b20taGlnaGxpZ2h0JylcbmltcG9ydCBldGNoID0gcmVxdWlyZSgnZXRjaCcpXG5cbmltcG9ydCB7XG4gIElDb250ZW50SXRlbSxcbiAgSWRlSGFza2VsbFJlcGxCYXNlLFxuICBJVmlld1N0YXRlLFxuICBJRXJyb3JJdGVtLFxufSBmcm9tICcuLi9pZGUtaGFza2VsbC1yZXBsLWJhc2UnXG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuL2J1dHRvbidcbmltcG9ydCB7IEVkaXRvciB9IGZyb20gJy4vZWRpdG9yJ1xuXG5leHBvcnQgeyBJVmlld1N0YXRlLCBJQ29udGVudEl0ZW0gfVxuXG5jb25zdCB0ZXJtRXNjYXBlUnggPSAvXFx4MUJcXFsoWzAtOV17MSwyfSg7WzAtOV17MSwyfSk/KT9bbXxLXS9nXG5cbmludGVyZmFjZSBJVmlld1N0YXRlT3V0cHV0IGV4dGVuZHMgSVZpZXdTdGF0ZSB7XG4gIGRlc2VyaWFsaXplcjogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIGV4dGVuZHMgSlNYLlByb3BzIHsgdXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwgc3RhdGU6IElWaWV3U3RhdGUgfVxuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsVmlldyBleHRlbmRzIElkZUhhc2tlbGxSZXBsQmFzZSBpbXBsZW1lbnRzIEpTWC5FbGVtZW50Q2xhc3Mge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwdWJsaWMgcmVmczoge1xuICAgIG91dHB1dDogSFRNTEVsZW1lbnRcbiAgICBlZGl0b3I6IEVkaXRvclxuICB9XG4gIHB1YmxpYyBlZGl0b3I6IFRleHRFZGl0b3JcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHJpdmF0ZSBvdXRwdXRGb250RmFtaWx5OiBzdHJpbmdcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHJpdmF0ZSBvdXRwdXRGb250U2l6ZTogc3RyaW5nXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgY29uc3RydWN0b3IocHVibGljIHByb3BzOiBJUHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcy51cGlQcm9taXNlLCBwcm9wcy5zdGF0ZSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gICAgdGhpcy5lZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5idWlsZFRleHRFZGl0b3Ioe1xuICAgICAgbGluZU51bWJlckd1dHRlclZpc2libGU6IGZhbHNlLFxuICAgICAgc29mdFdyYXBwZWQ6IHRydWUsXG4gICAgfSlcbiAgICB0aGlzLmVkaXRvci5zZXRHcmFtbWFyKGF0b20uZ3JhbW1hcnMuZ3JhbW1hckZvclNjb3BlTmFtZSgnc291cmNlLmhhc2tlbGwnKSlcblxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bnNhZmUtYW55XG4gICAgYXRvbS50ZXh0RWRpdG9ycy5hZGQodGhpcy5lZGl0b3IpXG5cbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChcbiAgICAgIGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yOiBUZXh0RWRpdG9yKSA9PiB7XG4gICAgICAgIGlmIChlZGl0b3IuZ2V0UGF0aCgpID09PSB0aGlzLnVyaSkge1xuICAgICAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZFNhdmUoKCkgPT4ge1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZTogbnVtYmVyKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRTaXplID0gYCR7Zm9udFNpemV9cHhgXG4gICAgfSkpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRGYW1pbHknLCAoZm9udEZhbWlseTogc3RyaW5nKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRGYW1pbHkgPSBmb250RmFtaWx5XG4gICAgfSkpXG5cbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCgpIHtcbiAgICBjb25zdCBpbnAgPSB0aGlzLmVkaXRvci5nZXRCdWZmZXIoKS5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KCcnKVxuICAgIGlmICh0aGlzLmdoY2kgJiYgdGhpcy5naGNpLmlzQnVzeSgpKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzLnB1c2goeyB0ZXh0OiBpbnAsIGhsOiBmYWxzZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0JyB9KVxuICAgICAgdGhpcy5naGNpLndyaXRlUmF3KGlucClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oaXN0b3J5LnNhdmUoaW5wKVxuICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChpbnApXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNvcHlUZXh0KGNvbW1hbmQ6IHN0cmluZykge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoY29tbWFuZClcbiAgICBhdG9tLnZpZXdzLmdldFZpZXcodGhpcy5lZGl0b3IpLmZvY3VzKClcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5QmFjaygpIHtcbiAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5lZGl0b3IuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29CYWNrKGN1cnJlbnQpKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlGb3J3YXJkKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGNsZWFyKCkge1xuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXRVUkkoKSB7XG4gICAgcmV0dXJuIGBpZGUtaGFza2VsbDovL3JlcGwvJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgZ2V0VGl0bGUoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95KCkge1xuICAgIGF3YWl0IGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gICAgcmV0dXJuIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIHNlcmlhbGl6ZSgpOiBJVmlld1N0YXRlT3V0cHV0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzZXJpYWxpemVyOiAnSWRlSGFza2VsbFJlcGxWaWV3JyxcbiAgICAgIHVyaTogdGhpcy51cmksXG4gICAgICBjb250ZW50OiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgaGlzdG9yeTogdGhpcy5oaXN0b3J5LnNlcmlhbGl6ZSgpLFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogdGhpcy5hdXRvUmVsb2FkUmVwZWF0LFxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUoKSB7XG4gICAgY29uc3QgYXRFbmQgPSAhIXRoaXMucmVmcyAmJlxuICAgICAgKHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wICsgdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHQgPj0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQpXG4gICAgY29uc3QgZm9jdXNlZCA9ICEhdGhpcy5yZWZzICYmICEhZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJlxuICAgICAgKHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSlcbiAgICBhd2FpdCBldGNoLnVwZGF0ZSh0aGlzKVxuICAgIGlmIChhdEVuZCkge1xuICAgICAgdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgPSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodCAtIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0XG4gICAgfVxuICAgIGlmIChmb2N1c2VkKSB7XG4gICAgICB0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlOm5vLXVuc2FmZS1hbnlcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgcmVmPVwib3V0cHV0XCJcbiAgICAgICAgICBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLW91dHB1dCBuYXRpdmUta2V5LWJpbmRpbmdzXCJcbiAgICAgICAgICB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogdGhpcy5vdXRwdXRGb250U2l6ZSwgZm9udEZhbWlseTogdGhpcy5vdXRwdXRGb250RmFtaWx5IH19XG4gICAgICAgID5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJ1dHRvbi1jb250YWluZXJcIj5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc31cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc31cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiY2xlYXJcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkNsZWFyIG91dHB1dFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZWRpdG9yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8RWRpdG9yIHJlZj1cImVkaXRvclwiIGVsZW1lbnQ9e2F0b20udmlld3MuZ2V0Vmlldyh0aGlzLmVkaXRvcil9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICAvLyB0c2xpbnQ6ZW5hYmxlOm5vLXVuc2FmZS1hbnlcbiAgICApXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5sb2FkKHRoaXMudXJpKVxuICAgIHRoaXMucHJvbXB0ID0gcmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVycihyZXMuc3RkZXJyKVxuICAgIHJldHVybiBzdXBlci5vbkluaXRpYWxMb2FkKClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyRGl2KCkge1xuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlOm5vLXVuc2FmZS1hbnlcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVycm9yXCI+XG4gICAgICAgICAge3RoaXMucmVuZGVyRXJyb3JzKCl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICAvLyB0c2xpbnQ6ZW5hYmxlOm5vLXVuc2FmZS1hbnlcbiAgICAgIClcbiAgICB9IGVsc2UgeyByZXR1cm4gbnVsbCB9IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6IG5vLW51bGwta2V5d29yZFxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJFcnJvcnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JzLm1hcChlcnIgPT4gdGhpcy5yZW5kZXJFcnJvcihlcnIpKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJFcnJvcihlcnJvcjogSUVycm9ySXRlbSkge1xuICAgIGNvbnN0IHBvcyA9IGVycm9yLnBvc2l0aW9uID8gUG9pbnQuZnJvbU9iamVjdChlcnJvci5wb3NpdGlvbikgOiB1bmRlZmluZWRcbiAgICBjb25zdCB1cmkgPSBlcnJvci51cmkgfHwgJzxpbnRlcmFjdGl2ZT4nXG4gICAgY29uc3QgcG9zaXRpb25UZXh0ID1cbiAgICAgICAgcG9zXG4gICAgICAgICAgPyBgJHt1cml9OiAke3Bvcy5yb3cgKyAxfSwgJHtwb3MuY29sdW1uICsgMX1gXG4gICAgICAgICAgOiB1cmlcbiAgICBjb25zdCBjb250ZXh0ID0gZXJyb3IuY29udGV4dCB8fCAnJ1xuICAgIHJldHVybiAoXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZTpuby11bnNhZmUtYW55XG4gICAgICA8ZGl2PlxuICAgICAgICB7cG9zaXRpb25UZXh0fToge2Vycm9yLnNldmVyaXR5fToge2NvbnRleHR9XG4gICAgICAgIHtlcnJvci5tZXNzYWdlfVxuICAgICAgPC9kaXY+XG4gICAgICAvLyB0c2xpbnQ6ZW5hYmxlOm5vLXVuc2FmZS1hbnlcbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlclByb21wdCgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbiAgICAgIDxkaXYgY2xhc3M9XCJyZXBsLXByb21wdFwiPnt0aGlzLnByb21wdCB8fCAnJ30mZ3Q7PC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJPdXRwdXQoKSB7XG4gICAgY29uc3QgbWF4TXNnID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLm1heE1lc3NhZ2VzJylcbiAgICBpZiAobWF4TXNnID4gMCkge1xuICAgICAgdGhpcy5tZXNzYWdlcyA9IHRoaXMubWVzc2FnZXMuc2xpY2UoLW1heE1zZylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXMubWFwKChtc2c6IElDb250ZW50SXRlbSkgPT4ge1xuICAgICAgY29uc3QgeyB0ZXh0LCBjbHMsIGhsIH0gPSBtc2dcbiAgICAgIGxldCB7IGhsY2FjaGUgfSA9IG1zZ1xuICAgICAgY29uc3QgY2xlYW5UZXh0ID0gdGV4dC5yZXBsYWNlKHRlcm1Fc2NhcGVSeCwgJycpXG4gICAgICBpZiAoaGwpIHtcbiAgICAgICAgaWYgKCFobGNhY2hlKSB7XG4gICAgICAgICAgaGxjYWNoZSA9IG1zZy5obGNhY2hlID0gaGlnaGxpZ2h0U3luYyh7IGZpbGVDb250ZW50czogY2xlYW5UZXh0LCBzY29wZU5hbWU6ICdzb3VyY2UuaGFza2VsbCcsIG5ic3A6IGZhbHNlIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuICAgICAgICAgIDxwcmUgY2xhc3NOYW1lPXtjbHN9IGlubmVySFRNTD17aGxjYWNoZX0gLz5cbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbiAgICAgICAgcmV0dXJuIDxwcmUgY2xhc3NOYW1lPXtjbHN9PntjbGVhblRleHR9PC9wcmU+XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIl19