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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFNeEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU07WUFDdkMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO29CQUNwQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO3dCQUFDLElBQUks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LENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDUCxNQUFNLENBQUMsQ0FDTCxrQkFBSyxTQUFTLEVBQUUsR0FBRyxFQUNqQixTQUFTLEVBQUUsYUFBYSxDQUFDLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBQyxDQUFDLEdBQ3pGLENBQ1AsQ0FBQTtZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsa0JBQUssU0FBUyxFQUFFLEdBQUcsSUFBRyxTQUFTLENBQU8sQ0FBQTtZQUMvQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUFqS0QsZ0RBaUtDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbiAgVGV4dEVkaXRvcixcbn0gZnJvbSAnYXRvbSdcbmltcG9ydCBoaWdobGlnaHRTeW5jID0gcmVxdWlyZSgnYXRvbS1oaWdobGlnaHQnKVxuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4uL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7QnV0dG9ufSBmcm9tICcuL2J1dHRvbidcbmltcG9ydCB7RWRpdG9yfSBmcm9tICcuL2VkaXRvcidcblxuZXhwb3J0IHtJVmlld1N0YXRlLCBJQ29udGVudEl0ZW19XG5cbmNvbnN0IHRlcm1Fc2NhcGVSeCA9IC9cXHgxQlxcWyhbMC05XXsxLDJ9KDtbMC05XXsxLDJ9KT8pP1ttfEtdL2dcblxuaW50ZXJmYWNlIElWaWV3U3RhdGVPdXRwdXQgZXh0ZW5kcyBJVmlld1N0YXRlIHtcbiAgZGVzZXJpYWxpemVyOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsVmlldyBleHRlbmRzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHB1YmxpYyByZWZzOiB7W2tleTogc3RyaW5nXTogYW55fVxuICBwdWJsaWMgZWRpdG9yOiBUZXh0RWRpdG9yXG4gIHByaXZhdGUgb3V0cHV0Rm9udEZhbWlseTogYW55XG4gIHByaXZhdGUgb3V0cHV0Rm9udFNpemU6IGFueVxuICBwcml2YXRlIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG4gIGNvbnN0cnVjdG9yICh1cGlQcm9taXNlLCBzdGF0ZTogSVZpZXdTdGF0ZSkge1xuICAgIHN1cGVyKHVwaVByb21pc2UsIHN0YXRlKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgICB0aGlzLmVkaXRvciA9IG5ldyBUZXh0RWRpdG9yKHtcbiAgICAgIGxpbmVOdW1iZXJHdXR0ZXJWaXNpYmxlOiBmYWxzZSxcbiAgICAgIHNvZnRXcmFwcGVkOiB0cnVlLFxuICAgICAgZ3JhbW1hcjogYXRvbS5ncmFtbWFycy5ncmFtbWFyRm9yU2NvcGVOYW1lKCdzb3VyY2UuaGFza2VsbCcpLFxuICAgIH0pXG5cbiAgICBhdG9tLnRleHRFZGl0b3JzLmFkZCh0aGlzLmVkaXRvcilcblxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgYXRvbS53b3Jrc3BhY2Uub2JzZXJ2ZVRleHRFZGl0b3JzKChlZGl0b3IpID0+IHtcbiAgICAgICAgaWYgKGVkaXRvci5nZXRVUkkoKSA9PT0gdGhpcy51cmkpIHtcbiAgICAgICAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRTYXZlKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmF1dG9SZWxvYWRSZXBlYXQpIHsgdGhpcy5naGNpUmVsb2FkUmVwZWF0KCkgfVxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRTaXplJywgKGZvbnRTaXplKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRTaXplID0gYCR7Zm9udFNpemV9cHhgXG4gICAgfSkpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRGYW1pbHknLCAoZm9udEZhbWlseSkgPT4ge1xuICAgICAgdGhpcy5vdXRwdXRGb250RmFtaWx5ID0gZm9udEZhbWlseVxuICAgIH0pKVxuXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZXhlY0NvbW1hbmQgKCkge1xuICAgIGxldCBpbnAgPSB0aGlzLmVkaXRvci5nZXRCdWZmZXIoKS5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KCcnKVxuICAgIHRoaXMuaGlzdG9yeS5zYXZlKGlucClcbiAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGlucClcbiAgfVxuXG4gIHB1YmxpYyBjb3B5VGV4dCAoY29tbWFuZCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoY29tbWFuZClcbiAgICB0aGlzLmVkaXRvci5lbGVtZW50LmZvY3VzKClcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5QmFjayAoKSB7XG4gICAgbGV0IGN1cnJlbnQgPSB0aGlzLmVkaXRvci5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0JhY2soY3VycmVudCkpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUZvcndhcmQgKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGdldFVSSSAoKSB7XG4gICAgcmV0dXJuIGBpZGUtaGFza2VsbDovL3JlcGwvJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgZ2V0VGl0bGUgKCkge1xuICAgIHJldHVybiBgUkVQTDogJHt0aGlzLnVyaX1gXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgZXRjaC5kZXN0cm95KHRoaXMpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgICBzdXBlci5kZXN0cm95KClcbiAgfVxuXG4gIHB1YmxpYyBzZXJpYWxpemUgKCk6IElWaWV3U3RhdGVPdXRwdXQge1xuICAgIHJldHVybiB7XG4gICAgICBkZXNlcmlhbGl6ZXI6ICdJZGVIYXNrZWxsUmVwbFZpZXcnLFxuICAgICAgdXJpOiB0aGlzLnVyaSxcbiAgICAgIGNvbnRlbnQ6IHRoaXMubWVzc2FnZXMsXG4gICAgICBoaXN0b3J5OiB0aGlzLmhpc3Rvcnkuc2VyaWFsaXplKCksXG4gICAgICBhdXRvUmVsb2FkUmVwZWF0OiB0aGlzLmF1dG9SZWxvYWRSZXBlYXQsXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSAoKSB7XG4gICAgbGV0IGF0RW5kID0gISF0aGlzLnJlZnMgJiZcbiAgICAgICh0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCArIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0ID49IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0KVxuICAgIGxldCBmb2N1c2VkID0gISF0aGlzLnJlZnMgJiYgISFkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmXG4gICAgICAodGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKVxuICAgIGF3YWl0IGV0Y2gudXBkYXRlKHRoaXMpXG4gICAgaWYgKGF0RW5kKSB7XG4gICAgICB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCA9IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHRcbiAgICB9XG4gICAgaWYgKGZvY3VzZWQpIHtcbiAgICAgIHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2IHJlZj1cIm91dHB1dFwiIGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtb3V0cHV0IG5hdGl2ZS1rZXktYmluZGluZ3NcIiB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17e2ZvbnRTaXplOiB0aGlzLm91dHB1dEZvbnRTaXplLCBmb250RmFtaWx5OiB0aGlzLm91dHB1dEZvbnRGYW1pbHl9fT5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVkaXRvclwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZWRpdG9yLWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgPEVkaXRvciByZWY9XCJlZGl0b3JcIiBlbGVtZW50PXt0aGlzLmVkaXRvci5lbGVtZW50fVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cInJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlJlbG9hZCBmaWxlIGFuZCByZXBlYXQgbGFzdCBjb21tYW5kXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJUb2dnbGUgcmVsb2FkLXJlcGVhdCBvbiBmaWxlIHNhdmVcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBzdGF0ZT17dGhpcy5hdXRvUmVsb2FkUmVwZWF0fVxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJJbnRlcnJ1cHQgY3VycmVudCBjb21wdXRhdGlvblwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlckVyckRpdiAoKSB7XG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVycm9yXCI+XG4gICAgICAgICAge3RoaXMuZXJyb3JzIC8qVE9ETyByZW5kZXIqL31cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJQcm9tcHQgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2Pnt0aGlzLnByb21wdCB8fCAnJ30mZ3Q7PC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJPdXRwdXQgKCkge1xuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzLm1hcCgoe3RleHQsIGNscywgaGx9OiBJQ29udGVudEl0ZW0pID0+IHtcbiAgICAgIGxldCBjbGVhblRleHQgPSB0ZXh0LnJlcGxhY2UodGVybUVzY2FwZVJ4LCAnJylcbiAgICAgIGlmIChobCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwcmUgY2xhc3NOYW1lPXtjbHN9XG4gICAgICAgICAgICBpbm5lckhUTUw9e2hpZ2hsaWdodFN5bmMoe2ZpbGVDb250ZW50czogY2xlYW5UZXh0LCBzY29wZU5hbWU6ICdzb3VyY2UuaGFza2VsbCcsIG5ic3A6IGZhbHNlfSl9ID5cbiAgICAgICAgICA8L3ByZT5cbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIDxwcmUgY2xhc3NOYW1lPXtjbHN9PntjbGVhblRleHR9PC9wcmU+XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIl19