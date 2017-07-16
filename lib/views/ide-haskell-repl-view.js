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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQVE5RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFZeEQsWUFBb0IsS0FBYTtRQUMvQixLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFEbEIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUUvQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQWtCO1lBQ25ELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztvQkFDcEMsRUFBRSxDQUFDLENBQUMsSUFBSSxD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QUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDOUMsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQWlCO1lBQ3pDLE1BQU0sRUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBQyxHQUFHLEdBQUcsQ0FBQTtZQUMzQixJQUFJLEVBQUMsT0FBTyxFQUFDLEdBQUcsR0FBRyxDQUFBO1lBQ25CLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBQ2hELEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNiLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFBO2dCQUM1RyxDQUFDO2dCQUNELE1BQU0sQ0FBQyxDQUNMLGtCQUFLLFNBQVMsRUFBRSxHQUFHLEVBQ2pCLFNBQVMsRUFBRSxPQUFPLEdBQ2QsQ0FDUCxDQUFBO1lBQ0gsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQyxrQkFBSyxTQUFTLEVBQUUsR0FBRyxJQUFHLFNBQVMsQ0FBTyxDQUFBO1lBQy9DLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQXhNRCxnREF3TUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBDb21wb3NpdGVEaXNwb3NhYmxlLFxuICBUZXh0RWRpdG9yLFxufSBmcm9tICdhdG9tJ1xuaW1wb3J0IGhpZ2hsaWdodFN5bmMgPSByZXF1aXJlKCdhdG9tLWhpZ2hsaWdodCcpXG5pbXBvcnQgZXRjaCA9IHJlcXVpcmUoJ2V0Y2gnKVxuXG5pbXBvcnQge1xuICBJQ29udGVudEl0ZW0sXG4gIElkZUhhc2tlbGxSZXBsQmFzZSxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuaW1wb3J0IHtCdXR0b259IGZyb20gJy4vYnV0dG9uJ1xuaW1wb3J0IHtFZGl0b3J9IGZyb20gJy4vZWRpdG9yJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbX1cblxuY29uc3QgdGVybUVzY2FwZVJ4ID0gL1xceDFCXFxbKFswLTldezEsMn0oO1swLTldezEsMn0pPyk/W218S10vZ1xuXG5pbnRlcmZhY2UgSVZpZXdTdGF0ZU91dHB1dCBleHRlbmRzIElWaWV3U3RhdGUge1xuICBkZXNlcmlhbGl6ZXI6IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcm9wcyBleHRlbmRzIEpTWC5Qcm9wcyB7dXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwgc3RhdGU6IElWaWV3U3RhdGV9XG5cbmV4cG9ydCBjbGFzcyBJZGVIYXNrZWxsUmVwbFZpZXcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2UgaW1wbGVtZW50cyBKU1guRWxlbWVudENsYXNzIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwdWJsaWMgcmVmczoge1xuICAgIG91dHB1dDogSFRNTEVsZW1lbnRcbiAgICBlZGl0b3I6IEVkaXRvclxuICB9XG4gIHB1YmxpYyBlZGl0b3I6IFRleHRFZGl0b3JcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwcml2YXRlIG91dHB1dEZvbnRGYW1pbHk6IHN0cmluZ1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZC1jbGFzcy1wcm9wZXJ0aWVzXG4gIHByaXZhdGUgb3V0cHV0Rm9udFNpemU6IHN0cmluZ1xuICBwcml2YXRlIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG4gIGNvbnN0cnVjdG9yIChwdWJsaWMgcHJvcHM6IElQcm9wcykge1xuICAgIHN1cGVyKHByb3BzLnVwaVByb21pc2UsIHByb3BzLnN0YXRlKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgICB0aGlzLmVkaXRvciA9IG5ldyBUZXh0RWRpdG9yKHtcbiAgICAgIGxpbmVOdW1iZXJHdXR0ZXJWaXNpYmxlOiBmYWxzZSxcbiAgICAgIHNvZnRXcmFwcGVkOiB0cnVlLFxuICAgICAgZ3JhbW1hcjogYXRvbS5ncmFtbWFycy5ncmFtbWFyRm9yU2NvcGVOYW1lKCdzb3VyY2UuaGFza2VsbCcpLFxuICAgIH0pXG5cbiAgICBhdG9tLnRleHRFZGl0b3JzLmFkZCh0aGlzLmVkaXRvcilcblxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKFxuICAgICAgYXRvbS53b3Jrc3BhY2Uub2JzZXJ2ZVRleHRFZGl0b3JzKChlZGl0b3I6IFRleHRFZGl0b3IpID0+IHtcbiAgICAgICAgaWYgKGVkaXRvci5nZXRQYXRoKCkgPT09IHRoaXMudXJpKSB7XG4gICAgICAgICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkU2F2ZSgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hdXRvUmVsb2FkUmVwZWF0KSB7IHRoaXMuZ2hjaVJlbG9hZFJlcGVhdCgpIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoJ2VkaXRvci5mb250U2l6ZScsIChmb250U2l6ZTogbnVtYmVyKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRTaXplID0gYCR7Zm9udFNpemV9cHhgXG4gICAgfSkpXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZSgnZWRpdG9yLmZvbnRGYW1pbHknLCAoZm9udEZhbWlseTogc3RyaW5nKSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRGYW1pbHkgPSBmb250RmFtaWx5XG4gICAgfSkpXG5cbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCAoKSB7XG4gICAgY29uc3QgaW5wID0gdGhpcy5lZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCgnJylcbiAgICBpZiAodGhpcy5naGNpICYmIHRoaXMuZ2hjaS5pc0J1c3koKSkge1xuICAgICAgdGhpcy5tZXNzYWdlcy5wdXNoKHt0ZXh0OiBpbnAsIGhsOiBmYWxzZSwgY2xzOiAnaWRlLWhhc2tlbGwtcmVwbC1pbnB1dC10ZXh0J30pXG4gICAgICB0aGlzLmdoY2kud3JpdGVSYXcoaW5wKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhpc3Rvcnkuc2F2ZShpbnApXG4gICAgICByZXR1cm4gdGhpcy5ydW5Db21tYW5kKGlucClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY29weVRleHQgKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoY29tbWFuZClcbiAgICB0aGlzLmVkaXRvci5lbGVtZW50LmZvY3VzKClcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5QmFjayAoKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHRoaXMuZWRpdG9yLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvQmFjayhjdXJyZW50KSlcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5Rm9yd2FyZCAoKSB7XG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29Gb3J3YXJkKCkpXG4gIH1cblxuICBwdWJsaWMgY2xlYXIgKCkge1xuICAgIHRoaXMubWVzc2FnZXMgPSBbXVxuICAgIHRoaXMudXBkYXRlKClcbiAgfVxuXG4gIHB1YmxpYyBnZXRVUkkgKCkge1xuICAgIHJldHVybiBgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGdldFRpdGxlICgpIHtcbiAgICByZXR1cm4gYFJFUEw6ICR7dGhpcy51cml9YFxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gICAgc3VwZXIuZGVzdHJveSgpXG4gIH1cblxuICBwdWJsaWMgc2VyaWFsaXplICgpOiBJVmlld1N0YXRlT3V0cHV0IHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzZXJpYWxpemVyOiAnSWRlSGFza2VsbFJlcGxWaWV3JyxcbiAgICAgIHVyaTogdGhpcy51cmksXG4gICAgICBjb250ZW50OiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgaGlzdG9yeTogdGhpcy5oaXN0b3J5LnNlcmlhbGl6ZSgpLFxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogdGhpcy5hdXRvUmVsb2FkUmVwZWF0LFxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKCkge1xuICAgIGNvbnN0IGF0RW5kID0gISF0aGlzLnJlZnMgJiZcbiAgICAgICh0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCArIHRoaXMucmVmcy5vdXRwdXQuY2xpZW50SGVpZ2h0ID49IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0KVxuICAgIGNvbnN0IGZvY3VzZWQgPSAhIXRoaXMucmVmcyAmJiAhIWRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiZcbiAgICAgICh0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpXG4gICAgYXdhaXQgZXRjaC51cGRhdGUodGhpcylcbiAgICBpZiAoYXRFbmQpIHtcbiAgICAgIHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wID0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQgLSB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodFxuICAgIH1cbiAgICBpZiAoZm9jdXNlZCkge1xuICAgICAgdGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmZvY3VzKClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsXCI+XG4gICAgICAgIDxkaXYgcmVmPVwib3V0cHV0XCIgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQgbmF0aXZlLWtleS1iaW5kaW5nc1wiIHRhYkluZGV4PVwiLTFcIlxuICAgICAgICAgIHN0eWxlPXt7Zm9udFNpemU6IHRoaXMub3V0cHV0Rm9udFNpemUsIGZvbnRGYW1pbHk6IHRoaXMub3V0cHV0Rm9udEZhbWlseX19PlxuICAgICAgICAgIHt0aGlzLnJlbmRlck91dHB1dCgpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAge3RoaXMucmVuZGVyRXJyRGl2KCl9XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYnV0dG9uLWNvbnRhaW5lclwiPlxuICAgICAgICAgIHt0aGlzLnJlbmRlclByb21wdCgpfVxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cInJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlJlbG9hZCBmaWxlIGFuZCByZXBlYXQgbGFzdCBjb21tYW5kXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJUb2dnbGUgcmVsb2FkLXJlcGVhdCBvbiBmaWxlIHNhdmVcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBzdGF0ZT17dGhpcy5hdXRvUmVsb2FkUmVwZWF0fVxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJJbnRlcnJ1cHQgY3VycmVudCBjb21wdXRhdGlvblwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJjbGVhclwiXG4gICAgICAgICAgICB0b29sdGlwPVwiQ2xlYXIgb3V0cHV0XCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOmNsZWFyLW91dHB1dFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lZGl0b3JcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImVkaXRvci1jb250YWluZXJcIj5cbiAgICAgICAgICAgIDxFZGl0b3IgcmVmPVwiZWRpdG9yXCIgZWxlbWVudD17dGhpcy5lZGl0b3IuZWxlbWVudH0gLz5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25Jbml0aWFsTG9hZCAoKSB7XG4gICAgaWYgKCF0aGlzLmdoY2kpIHsgdGhyb3cgbmV3IEVycm9yKCdObyBHSENJIGluc3RhbmNlIScpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmdoY2kubG9hZCh0aGlzLnVyaSlcbiAgICB0aGlzLnByb21wdCA9IHJlcy5wcm9tcHRbMV1cbiAgICB0aGlzLmVycm9yc0Zyb21TdGRlcnIgKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHN1cGVyLm9uSW5pdGlhbExvYWQoKVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJFcnJEaXYgKCkge1xuICAgIGlmICghdGhpcy51cGkpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1lcnJvclwiPlxuICAgICAgICAgIHt0aGlzLmVycm9ycyAvKlRPRE8gcmVuZGVyKi99XG4gICAgICAgIDwvZGl2PlxuICAgICAgKVxuICAgIH0gZWxzZSB7IHJldHVybiBudWxsIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyUHJvbXB0ICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzcz1cInJlcGwtcHJvbXB0XCI+e3RoaXMucHJvbXB0IHx8ICcnfSZndDs8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlck91dHB1dCAoKSB7XG4gICAgY29uc3QgbWF4TXNnID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLm1heE1lc3NhZ2VzJylcbiAgICBpZiAobWF4TXNnID4gMCkge1xuICAgICAgdGhpcy5tZXNzYWdlcyA9IHRoaXMubWVzc2FnZXMuc2xpY2UoLW1heE1zZylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubWVzc2FnZXMubWFwKChtc2c6IElDb250ZW50SXRlbSkgPT4ge1xuICAgICAgY29uc3Qge3RleHQsIGNscywgaGx9ID0gbXNnXG4gICAgICBsZXQge2hsY2FjaGV9ID0gbXNnXG4gICAgICBjb25zdCBjbGVhblRleHQgPSB0ZXh0LnJlcGxhY2UodGVybUVzY2FwZVJ4LCAnJylcbiAgICAgIGlmIChobCkge1xuICAgICAgICBpZiAoIWhsY2FjaGUpIHtcbiAgICAgICAgICBobGNhY2hlID0gbXNnLmhsY2FjaGUgPSBoaWdobGlnaHRTeW5jKHtmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZX0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cHJlIGNsYXNzTmFtZT17Y2xzfVxuICAgICAgICAgICAgaW5uZXJIVE1MPXtobGNhY2hlfT5cbiAgICAgICAgICA8L3ByZT5cbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIDxwcmUgY2xhc3NOYW1lPXtjbHN9PntjbGVhblRleHR9PC9wcmU+XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIl19