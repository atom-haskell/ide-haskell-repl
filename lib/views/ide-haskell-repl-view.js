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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC12aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldy50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUdhO0FBQ2IsZ0RBQWdEO0FBQ2hELDZCQUE2QjtBQUU3QixvRUFJaUM7QUFDakMscUNBQStCO0FBQy9CLHFDQUErQjtBQUkvQixNQUFNLFlBQVksR0FBRyx5Q0FBeUMsQ0FBQTtBQU05RCx3QkFBZ0MsU0FBUSwwQ0FBa0I7SUFNeEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUU1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksaUJBQVUsQ0FBQztZQUMzQix1QkFBdUIsRUFBRSxLQUFLO1lBQzlCLFdBQVcsRUFBRSxJQUFJO1lBQ2pCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDO1NBQzdELENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU07WUFDdkMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO29CQUNwQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO3dCQUFDLElBQUks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QUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFBO2dCQUM1RyxDQUFDO2dCQUNELE1BQU0sQ0FBQyxDQUNMLGtCQUFLLFNBQVMsRUFBRSxHQUFHLEVBQ2pCLFNBQVMsRUFBRSxPQUFPLEdBQ2QsQ0FDUCxDQUFBO1lBQ0gsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQyxrQkFBSyxTQUFTLEVBQUUsR0FBRyxJQUFHLFNBQVMsQ0FBTyxDQUFBO1lBQy9DLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTVMRCxnREE0TEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBDb21wb3NpdGVEaXNwb3NhYmxlLFxuICBUZXh0RWRpdG9yLFxufSBmcm9tICdhdG9tJ1xuaW1wb3J0IGhpZ2hsaWdodFN5bmMgPSByZXF1aXJlKCdhdG9tLWhpZ2hsaWdodCcpXG5pbXBvcnQgZXRjaCA9IHJlcXVpcmUoJ2V0Y2gnKVxuXG5pbXBvcnQge1xuICBJQ29udGVudEl0ZW0sXG4gIElkZUhhc2tlbGxSZXBsQmFzZSxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuaW1wb3J0IHtCdXR0b259IGZyb20gJy4vYnV0dG9uJ1xuaW1wb3J0IHtFZGl0b3J9IGZyb20gJy4vZWRpdG9yJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbX1cblxuY29uc3QgdGVybUVzY2FwZVJ4ID0gL1xceDFCXFxbKFswLTldezEsMn0oO1swLTldezEsMn0pPyk/W218S10vZ1xuXG5pbnRlcmZhY2UgSVZpZXdTdGF0ZU91dHB1dCBleHRlbmRzIElWaWV3U3RhdGUge1xuICBkZXNlcmlhbGl6ZXI6IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxWaWV3IGV4dGVuZHMgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHVibGljIHJlZnM6IHtba2V5OiBzdHJpbmddOiBhbnl9XG4gIHB1YmxpYyBlZGl0b3I6IFRleHRFZGl0b3JcbiAgcHJpdmF0ZSBvdXRwdXRGb250RmFtaWx5OiBhbnlcbiAgcHJpdmF0ZSBvdXRwdXRGb250U2l6ZTogYW55XG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gICAgc3VwZXIodXBpUHJvbWlzZSwgc3RhdGUpXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICAgIHRoaXMuZWRpdG9yID0gbmV3IFRleHRFZGl0b3Ioe1xuICAgICAgbGluZU51bWJlckd1dHRlclZpc2libGU6IGZhbHNlLFxuICAgICAgc29mdFdyYXBwZWQ6IHRydWUsXG4gICAgICBncmFtbWFyOiBhdG9tLmdyYW1tYXJzLmdyYW1tYXJGb3JTY29wZU5hbWUoJ3NvdXJjZS5oYXNrZWxsJyksXG4gICAgfSlcblxuICAgIGF0b20udGV4dEVkaXRvcnMuYWRkKHRoaXMuZWRpdG9yKVxuXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoXG4gICAgICBhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMoKGVkaXRvcikgPT4ge1xuICAgICAgICBpZiAoZWRpdG9yLmdldFVSSSgpID09PSB0aGlzLnVyaSkge1xuICAgICAgICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvci5vbkRpZFNhdmUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXV0b1JlbG9hZFJlcGVhdCkgeyB0aGlzLmdoY2lSZWxvYWRSZXBlYXQoKSB9XG4gICAgICAgICAgfSkpXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIClcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udFNpemUnLCAoZm9udFNpemUpID0+IHtcbiAgICAgIHRoaXMub3V0cHV0Rm9udFNpemUgPSBgJHtmb250U2l6ZX1weGBcbiAgICB9KSlcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKCdlZGl0b3IuZm9udEZhbWlseScsIChmb250RmFtaWx5KSA9PiB7XG4gICAgICB0aGlzLm91dHB1dEZvbnRGYW1pbHkgPSBmb250RmFtaWx5XG4gICAgfSkpXG5cbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBleGVjQ29tbWFuZCAoKSB7XG4gICAgY29uc3QgaW5wID0gdGhpcy5lZGl0b3IuZ2V0QnVmZmVyKCkuZ2V0VGV4dCgpXG4gICAgdGhpcy5lZGl0b3Iuc2V0VGV4dCgnJylcbiAgICB0aGlzLmhpc3Rvcnkuc2F2ZShpbnApXG4gICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChpbnApXG4gIH1cblxuICBwdWJsaWMgY29weVRleHQgKGNvbW1hbmQpIHtcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KGNvbW1hbmQpXG4gICAgdGhpcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUJhY2sgKCkge1xuICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmVkaXRvci5nZXRUZXh0KClcbiAgICB0aGlzLmVkaXRvci5zZXRUZXh0KHRoaXMuaGlzdG9yeS5nb0JhY2soY3VycmVudCkpXG4gIH1cblxuICBwdWJsaWMgaGlzdG9yeUZvcndhcmQgKCkge1xuICAgIHRoaXMuZWRpdG9yLnNldFRleHQodGhpcy5oaXN0b3J5LmdvRm9yd2FyZCgpKVxuICB9XG5cbiAgcHVibGljIGNsZWFyICgpIHtcbiAgICB0aGlzLm1lc3NhZ2VzID0gW11cbiAgICB0aGlzLnVwZGF0ZSgpXG4gIH1cblxuICBwdWJsaWMgZ2V0VVJJICgpIHtcbiAgICByZXR1cm4gYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBnZXRUaXRsZSAoKSB7XG4gICAgcmV0dXJuIGBSRVBMOiAke3RoaXMudXJpfWBcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIHNlcmlhbGl6ZSAoKTogSVZpZXdTdGF0ZU91dHB1dCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlc2VyaWFsaXplcjogJ0lkZUhhc2tlbGxSZXBsVmlldycsXG4gICAgICB1cmk6IHRoaXMudXJpLFxuICAgICAgY29udGVudDogdGhpcy5tZXNzYWdlcyxcbiAgICAgIGhpc3Rvcnk6IHRoaXMuaGlzdG9yeS5zZXJpYWxpemUoKSxcbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQ6IHRoaXMuYXV0b1JlbG9hZFJlcGVhdCxcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlICgpIHtcbiAgICBjb25zdCBhdEVuZCA9ICEhdGhpcy5yZWZzICYmXG4gICAgICAodGhpcy5yZWZzLm91dHB1dC5zY3JvbGxUb3AgKyB0aGlzLnJlZnMub3V0cHV0LmNsaWVudEhlaWdodCA+PSB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbEhlaWdodClcbiAgICBjb25zdCBmb2N1c2VkID0gISF0aGlzLnJlZnMgJiYgISFkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmXG4gICAgICAodGhpcy5yZWZzLmVkaXRvci5lbGVtZW50LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKVxuICAgIGF3YWl0IGV0Y2gudXBkYXRlKHRoaXMpXG4gICAgaWYgKGF0RW5kKSB7XG4gICAgICB0aGlzLnJlZnMub3V0cHV0LnNjcm9sbFRvcCA9IHRoaXMucmVmcy5vdXRwdXQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5yZWZzLm91dHB1dC5jbGllbnRIZWlnaHRcbiAgICB9XG4gICAgaWYgKGZvY3VzZWQpIHtcbiAgICAgIHRoaXMucmVmcy5lZGl0b3IuZWxlbWVudC5mb2N1cygpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaWRlLWhhc2tlbGwtcmVwbFwiPlxuICAgICAgICA8ZGl2IHJlZj1cIm91dHB1dFwiIGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtb3V0cHV0IG5hdGl2ZS1rZXktYmluZGluZ3NcIiB0YWJJbmRleD1cIi0xXCJcbiAgICAgICAgICBzdHlsZT17e2ZvbnRTaXplOiB0aGlzLm91dHB1dEZvbnRTaXplLCBmb250RmFtaWx5OiB0aGlzLm91dHB1dEZvbnRGYW1pbHl9fT5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJPdXRwdXQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHt0aGlzLnJlbmRlckVyckRpdigpfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJ1dHRvbi1jb250YWluZXJcIj5cbiAgICAgICAgICB7dGhpcy5yZW5kZXJQcm9tcHQoKX1cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICBjbHM9XCJyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHRvb2x0aXA9XCJSZWxvYWQgZmlsZSBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0XCJcbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImF1dG8tcmVsb2FkLXJlcGVhdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiVG9nZ2xlIHJlbG9hZC1yZXBlYXQgb24gZmlsZSBzYXZlXCJcbiAgICAgICAgICAgIGNvbW1hbmQ9XCJpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXRcIlxuICAgICAgICAgICAgc3RhdGU9e3RoaXMuYXV0b1JlbG9hZFJlcGVhdH1cbiAgICAgICAgICAgIHBhcmVudD17dGhpc30vPlxuICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgIGNscz1cImludGVycnVwdFwiXG4gICAgICAgICAgICB0b29sdGlwPVwiSW50ZXJydXB0IGN1cnJlbnQgY29tcHV0YXRpb25cIlxuICAgICAgICAgICAgY29tbWFuZD1cImlkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgY2xzPVwiY2xlYXJcIlxuICAgICAgICAgICAgdG9vbHRpcD1cIkNsZWFyIG91dHB1dFwiXG4gICAgICAgICAgICBjb21tYW5kPVwiaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXRcIlxuICAgICAgICAgICAgcGFyZW50PXt0aGlzfS8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImlkZS1oYXNrZWxsLXJlcGwtZWRpdG9yXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJlZGl0b3ItY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8RWRpdG9yIHJlZj1cImVkaXRvclwiIGVsZW1lbnQ9e3RoaXMuZWRpdG9yLmVsZW1lbnR9IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS5sb2FkKHRoaXMudXJpKVxuICAgIHRoaXMucHJvbXB0ID0gcmVzLnByb21wdFsxXVxuICAgIHRoaXMuZXJyb3JzRnJvbVN0ZGVyciAocmVzLnN0ZGVycilcbiAgICByZXR1cm4gc3VwZXIub25Jbml0aWFsTG9hZCgpXG4gIH1cblxuICBwcml2YXRlIHJlbmRlckVyckRpdiAoKSB7XG4gICAgaWYgKCF0aGlzLnVwaSkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpZGUtaGFza2VsbC1yZXBsLWVycm9yXCI+XG4gICAgICAgICAge3RoaXMuZXJyb3JzIC8qVE9ETyByZW5kZXIqL31cbiAgICAgICAgPC9kaXY+XG4gICAgICApXG4gICAgfSBlbHNlIHsgcmV0dXJuIG51bGwgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJQcm9tcHQgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzPVwicmVwbC1wcm9tcHRcIj57dGhpcy5wcm9tcHQgfHwgJyd9Jmd0OzwvZGl2PlxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyT3V0cHV0ICgpIHtcbiAgICBjb25zdCBtYXhNc2cgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwubWF4TWVzc2FnZXMnKVxuICAgIGlmIChtYXhNc2cgPiAwKSB7XG4gICAgICB0aGlzLm1lc3NhZ2VzID0gdGhpcy5tZXNzYWdlcy5zbGljZSgtbWF4TXNnKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5tZXNzYWdlcy5tYXAoKG1zZzogSUNvbnRlbnRJdGVtKSA9PiB7XG4gICAgICBjb25zdCB7dGV4dCwgY2xzLCBobH0gPSBtc2dcbiAgICAgIGxldCB7aGxjYWNoZX0gPSBtc2dcbiAgICAgIGNvbnN0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSh0ZXJtRXNjYXBlUngsICcnKVxuICAgICAgaWYgKGhsKSB7XG4gICAgICAgIGlmICghaGxjYWNoZSkge1xuICAgICAgICAgIGhsY2FjaGUgPSBtc2cuaGxjYWNoZSA9IGhpZ2hsaWdodFN5bmMoe2ZpbGVDb250ZW50czogY2xlYW5UZXh0LCBzY29wZU5hbWU6ICdzb3VyY2UuaGFza2VsbCcsIG5ic3A6IGZhbHNlfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxwcmUgY2xhc3NOYW1lPXtjbHN9XG4gICAgICAgICAgICBpbm5lckhUTUw9e2hsY2FjaGV9PlxuICAgICAgICAgIDwvcHJlPlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPHByZSBjbGFzc05hbWU9e2Nsc30+e2NsZWFuVGV4dH08L3ByZT5cbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iXX0=