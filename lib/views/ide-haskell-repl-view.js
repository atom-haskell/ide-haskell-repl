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
        let maxMsg = atom.config.get('ide-haskell-repl.maxMessages');
        if (maxMsg > 0) {
            this.messages = this.messages.slice(-maxMsg);
        }
        return this.messages.map((msg) => {
            let { text, cls, hl, hlcache } = msg;
            let cleanText = text.replace(termEscapeRx, '');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFNeEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU07WUFDdkMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO29CQUNwQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO3dCQUFDLElBQUks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Q0FBQTtJQUNKLENBQUM7Q0FDRjtBQWhMRCxnREFnTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBDb21wb3NpdGVEaXNwb3NhYmxlLFxuICBUZXh0RWRpdG9yLFxufSBmcm9tICdhdG9tJ1xuaW1wb3J0IGhpZ2hsaWdodFN5bmMgPSByZXF1aXJlKCdhdG9tLWhpZ2hsaWdodCcpXG5pbXBvcnQgZXRjaCA9IHJlcXVpcmUoJ2V0Y2gnKVxuXG5pbXBvcnQge1xuICBJQ29udGVudEl0ZW0sXG4gIElkZUhhc2tlbGxSZXBsQmFzZSxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuaW1wb3J0IHtCdXR0b259IGZyb20gJy4vYnV0dG9uJ1xuaW1wb3J0IHtFZGl0b3J9IGZyb20gJy4vZWRpdG9yJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbX1cblxuY29uc3QgdGVybUVzY2FwZVJ4ID0gL1xceDFCXFxbKFswLTldezEsMn0oO1swLTldezEsMn0pPyk/W218S10vZ1xuXG5pbnRlcmZhY2UgSVZpZXdTdGF0ZU91dHB1dCBleHRlbmRzIElWaWV3U3RhdGUge1xuICBkZXNlcmlhbGl6ZXI6IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxWaWV3IGV4dGVuZHMgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHJlZnM6IHtba2V5OiBzdHJpbmddOiBhbnl9XG4gIHB1YmxpYyBlZGl0b3I6IFRleHRFZGl0b3JcbiAgcHJpdmF0ZSBvdXRwdXRGb250RmFtaWx5OiBhbnlcbiAgcHJpdmF0ZSBvdXRwdXRGb250U2l6ZTogYW55XG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gICAgc3VwZXIodXBpUHJvbWlzZSwgc3RhdGUpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICAgIHRoaXMuZWRpdG9yID0gbmV3IFRleHRFZGl0b3Ioe1xuICAgICAgbGluZU51bWJlckd1dHRlclZpc2libGU6IGZhbHNlLFxuICAgICAgc29mdFdyYXBwZWQ6IHRydWUsXG4gICAgICBncmFtbWFyOiBhdG9tLmdyYW1tYXJzLmdyYW1tYXJGb3JTY29wZU5hbWUoJ3NvdXJjZS5oYXNrZWxsJyksXG4gICAgfSlcblxuICAgIGF0b20udGV4dEVkaXRvcnMuYWRkKHRoaXMuZWRpdG9yKVxuXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoXG4gICAgICBhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMoKGVkaXRvcikgPT4ge1xuICAgICAgICBpZiAoZWRpdG9yLmdldFVSSSgpID09PSB0aGlzLnVyaSkge1xuICAgICAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZFNhdmUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0b1JlbG9hZFJlcGVhdCkgeyB0aGlzLmdoY2lSZWxvYWRSZXBlYXQoKSB9XG4gICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udFNpemUnLCAoZm9udFNpemUpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udFNpemUgPSBgJHtmb250U2l6ZX1weGBcbiAgICB9KSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udEZhbWlseScsIChmb250RmFtaWx5KSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRGYW1pbHkgPSBmb250RmFtaWx5XG4gICAgfSkpXG5cbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCAoKSB7XG4gICAgbGV0IGlucCA9IHRoaXMuZWRpdG9yLmdldEJ1ZmZlcigpLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQoJycpXG4gICAgdGhpcy5oaXN0b3J5LnNhdmUoaW5wKVxuICAgIHJldHVybiB0aGlzLnJ1bkNvbW1hbmQoaW5wKVxuICB9XG5cbiAgcHVibGljIGNvcHlUZXh0IChjb21tYW5kKSB7XG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dChjb21tYW5kKVxuICAgIHRoaXMuZWRpdG9yLmVsZW1lbnQuZm9jdXMoKVxuICB9XG5cbiAgcHVibGljIGhpc3RvcnlCYWNrICgpIHtcbiAgICBsZXQgY3VycmVudCA9IHRoaXMuZWRpdG9yLmdldFRleHQoKVxuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvQmFjayhjdXJyZW50KSlcbiAgfVxuXG4gIHB1YmxpYyBoaXN0b3J5Rm9yd2FyZCAoKSB7XG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCh0aGlzLmhpc3RvcnkuZ29Gb3J3YXJkKCkpXG4gIH1cblxuICBwdWJsaWMgZ2V0VVJJICgpIHtcbiAgICByZXR1cm4gYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBnZXRUaXRsZSAoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIHNlcmlhbGl6ZSAoKTogSVZpZXdTdGF0ZU91dHB1dCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlc2VyaWFsaXplcjogJ0lkZUhhc2tlbGxSZXBsVmlldycsXG4gICAgICB1cmk6IHRoaXMudXJpLFxuICAgICAgY29udGVudDogdGhpcy5tZXNzYWdlcyxcbiAgICAgIGhpc3Rvcnk6IHRoaXMuaGlzdG9yeS5zZXJpYWxpemUoKSxcbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQ6IHRoaXMuYXV0b1JlbG9hZFJlcGVhdCxcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlICgpIHtcbiAgICBsZXQgYXRFbmQgPSAhIXRoaXMucmVmcyAmJlxuICAgICAgKHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wICsgdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHQgPj0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQpXG4gICAgbGV0IGZvY3VzZWQgPSAhIXRoaXMucmVmcyAmJiAhIWRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiZcbiAgICAgICh0aGlzLnJlZnMuZWRpdG9yLmVsZW1lbnQuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpXG4gICAgYXdhaXQgZXRjaC51cGRhdGUodGhpcylcbiAgICBpZiAoYXRFbmQpIHtcbiAgICAgIHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsVG9wID0gdGhpcy5yZWZzLm91dHB1dC5zY3JvbGxIZWlnaHQgLSB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodFxuICAgIH1cbiAgICBpZiAoZm9jdXNlZCkge1xuICAgICAgdGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmZvY3VzKClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsXCI+XG4gICAgICAgIDxkaXYgcmVmPVwib3V0cHV0XCIgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbC1vdXRwdXQgbmF0aXZlLWtleS1iaW5kaW5nc1wiIHRhYkluZGV4PVwiLTFcIlxuICAgICAgICAgIHN0eWxlPXt7Zm9udFNpemU6IHRoaXMub3V0cHV0Rm9udFNpemUsIGZvbnRGYW1pbHk6IHRoaXMub3V0cHV0Rm9udEZhbWlseX19PlxuICAgICAgICAgIHt0aGlzLnJlbmRlck91dHB1dCgpfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAge3RoaXMucmVuZGVyRXJyRGl2KCl9XG4gICAgICAgIHt0aGlzLnJlbmRlclByb21wdCgpfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZWRpdG9yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8RWRpdG9yIHJlZj1cImVkaXRvclwiIGVsZW1lbnQ9e3RoaXMuZWRpdG9yLmVsZW1lbnR9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwicmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiUmVsb2FkIGZpbGUgYW5kIHJlcGVhdCBsYXN0IGNvbW1hbmRcIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJhdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIlRvZ2dsZSByZWxvYWQtcmVwZWF0IG9uIGZpbGUgc2F2ZVwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHN0YXRlPXt0aGlzLmF1dG9SZWxvYWRSZXBlYXR9XG4gICAgICAgICAgICBwYXJlbnQ9e3RoaXN9Lz5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJpbnRlcnJ1cHRcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkludGVycnVwdCBjdXJyZW50IGNvbXB1dGF0aW9uXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICBsZXQgcmVzID0gYXdhaXQgdGhpcy5naGNpLmxvYWQodGhpcy51cmkpXG4gICAgdGhpcy5wcm9tcHQgPSByZXMucHJvbXB0WzFdXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyIChyZXMuc3RkZXJyKVxuICAgIHJldHVybiBzdXBlci5vbkluaXRpYWxMb2FkKClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyRXJyRGl2ICgpIHtcbiAgICBpZiAoIXRoaXMudXBpKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZXJyb3JcIj5cbiAgICAgICAgICB7dGhpcy5lcnJvcnMgLypUT0RPIHJlbmRlciovfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIClcbiAgICB9IGVsc2UgeyByZXR1cm4gbnVsbCB9XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclByb21wdCAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXY+e3RoaXMucHJvbXB0IHx8ICcnfSZndDs8L2Rpdj5cbiAgICApXG4gIH1cblxuICBwcml2YXRlIHJlbmRlck91dHB1dCAoKSB7XG4gICAgbGV0IG1heE1zZyA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5tYXhNZXNzYWdlcycpXG4gICAgaWYgKG1heE1zZyA+IDApIHtcbiAgICAgIHRoaXMubWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzLnNsaWNlKC1tYXhNc2cpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1lc3NhZ2VzLm1hcCgobXNnOiBJQ29udGVudEl0ZW0pID0+IHtcbiAgICAgIGxldCB7dGV4dCwgY2xzLCBobCwgaGxjYWNoZX0gPSBtc2dcbiAgICAgIGxldCBjbGVhblRleHQgPSB0ZXh0LnJlcGxhY2UodGVybUVzY2FwZVJ4LCAnJylcbiAgICAgIGlmIChobCkge1xuICAgICAgICBpZiAoIWhsY2FjaGUpIHtcbiAgICAgICAgICBobGNhY2hlID0gbXNnLmhsY2FjaGUgPSBoaWdobGlnaHRTeW5jKHtmaWxlQ29udGVudHM6IGNsZWFuVGV4dCwgc2NvcGVOYW1lOiAnc291cmNlLmhhc2tlbGwnLCBuYnNwOiBmYWxzZX0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8cHJlIGNsYXNzTmFtZT17Y2xzfVxuICAgICAgICAgICAgaW5uZXJIVE1MPXtobGNhY2hlfT5cbiAgICAgICAgICA8L3ByZT5cbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIDxwcmUgY2xhc3NOYW1lPXtjbHN9PntjbGVhblRleHR9PC9wcmU+XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIl19