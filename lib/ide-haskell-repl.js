"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const ide_haskell_repl_bg_1 = require("./ide-haskell-repl-bg");
const ide_haskell_repl_view_1 = require("./views/ide-haskell-repl-view");
__export(require("./config"));
let disposables;
const editorMap = new WeakMap();
const bgEditorMap = new WeakMap();
let resolveUPIPromise;
const upiPromise = new Promise((resolve) => { resolveUPIPromise = resolve; });
let UPI;
function activate(state) {
    disposables = new atom_1.CompositeDisposable();
    disposables.add(atom.workspace.addOpener((uriToOpen, options) => {
        const m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/);
        if (!(m && m[1])) {
            return;
        }
        return createReplView({ uri: m[1] });
    }));
    disposables.add(atom.commands.add('atom-text-editor', {
        'ide-haskell-repl:toggle': ({ currentTarget }) => __awaiter(this, void 0, void 0, function* () { return open(currentTarget.getModel()); }),
    }));
    const commandFunction = (func) => ({ currentTarget }) => {
        const view = editorMap.get(currentTarget.getModel());
        if (view) {
            view[func]();
        }
    };
    disposables.add(atom.commands.add('atom-text-editor.ide-haskell-repl', {
        'ide-haskell-repl:exec-command': commandFunction('execCommand'),
        'ide-haskell-repl:history-back': commandFunction('historyBack'),
        'ide-haskell-repl:history-forward': commandFunction('historyForward'),
        'ide-haskell-repl:ghci-reload': commandFunction('ghciReload'),
        'ide-haskell-repl:reload-repeat': commandFunction('ghciReloadRepeat'),
        'ide-haskell-repl:toggle-auto-reload-repeat': commandFunction('toggleAutoReloadRepeat'),
        'ide-haskell-repl:ghci-interrupt': commandFunction('interrupt'),
        'ide-haskell-repl:clear-output': commandFunction('clear'),
    }));
    const externalCommandFunction = (func) => ({ currentTarget }) => {
        open(currentTarget.getModel(), false)
            .then((model) => model[func]());
    };
    disposables.add(atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
        'ide-haskell-repl:copy-selection-to-repl-input': ({ currentTarget }) => {
            const ed = currentTarget.getModel();
            const cmd = ed.getLastSelection().getText();
            open(ed).then((model) => model.copyText(cmd));
        },
        'ide-haskell-repl:run-selection-in-repl': ({ currentTarget }) => {
            const ed = currentTarget.getModel();
            const cmd = ed.getLastSelection().getText();
            open(ed, false).then((model) => __awaiter(this, void 0, void 0, function* () { return model.runCommand(cmd); }));
        },
        'ide-haskell-repl:ghci-reload': externalCommandFunction('ghciReload'),
        'ide-haskell-repl:reload-repeat': externalCommandFunction('ghciReloadRepeat'),
        'ide-haskell-repl:toggle-auto-reload-repeat': externalCommandFunction('toggleAutoReloadRepeat'),
    }));
    disposables.add(atom.menu.add([{
            label: 'Haskell IDE',
            submenu: [{
                    label: 'Open REPL',
                    command: 'ide-haskell-repl:toggle',
                }],
        }]));
    setTimeout(() => {
        if (resolveUPIPromise && !UPI) {
            resolveUPIPromise(null);
        }
    }, 5000);
}
exports.activate = activate;
function createReplView({ uri, content, history, autoReloadRepeat }) {
    const view = new ide_haskell_repl_view_1.IdeHaskellReplView(upiPromise, { uri, content, history, autoReloadRepeat });
    editorMap.set(view.editor, view);
    return view;
}
exports.createReplView = createReplView;
function open(editor, activate = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const grammar = editor ? editor.getGrammar() : null;
        const scope = grammar ? grammar.scopeName : null;
        let uri;
        if (scope && scope.endsWith('haskell')) {
            uri = editor.getURI();
        }
        else {
            uri = '';
        }
        return atom.workspace.open(`ide-haskell://repl/${uri}`, {
            split: 'right',
            searchAllPanes: true,
            activatePane: activate,
        });
    });
}
function deactivate() {
    disposables.dispose();
}
exports.deactivate = deactivate;
function consumeUPI(service) {
    const disp = service.consume({
        name: 'ide-haskell-repl',
        messageTypes: {
            repl: {
                uriFilter: false,
                autoScroll: true,
            },
        },
        tooltipEvent: {
            priority: 200,
            handler: shouldShowTooltip,
        },
        consumer: (upi) => {
            UPI = upi;
            resolveUPIPromise(upi);
        },
    });
    disposables.add(disp);
    return disp;
}
exports.consumeUPI = consumeUPI;
function shouldShowTooltip(editor, crange, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!atom.config.get('ide-haskell-repl.showTypes')) {
            return null;
        }
        let bg;
        const bgt = bgEditorMap.get(editor);
        if (bgt) {
            bg = bgt;
        }
        else {
            if (!editor.getPath()) {
                return null;
            }
            yield upiPromise;
            bg = new ide_haskell_repl_bg_1.IdeHaskellReplBg(upiPromise, { uri: editor.getPath() });
            bgEditorMap.set(editor, bg);
        }
        return bg.showTypeAt(editor.getPath(), crange);
    });
}
function autocompleteProvider_3_0_0() {
    return {
        scopeSelector: '.source.haskell',
        disableForScopeSelector: '.source.haskell .comment',
        getTextEditorSelector: () => 'atom-text-editor.ide-haskell-repl',
        inclusionPriority: 0,
        getSuggestions: ({ editor, prefix }) => __awaiter(this, void 0, void 0, function* () {
            const view = editorMap.get(editor);
            if (!view) {
                return [];
            }
            return view.getCompletions(prefix);
        }),
    };
}
exports.autocompleteProvider_3_0_0 = autocompleteProvider_3_0_0;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBd0M7QUFDeEMsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFHeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLE1BQU0sU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLE1BQU0sV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLElBQUksaUJBQThDLENBQUE7QUFDbEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLE9BQU8saUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDMUYsSUFBSSxHQUFpQixDQUFBO0FBRXJCLGtCQUEwQixLQUFLO0lBQzdCLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7SUFFdkMsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPO1FBQzFDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN6RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUE7UUFDUixDQUFDO1FBQ0QsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFBO0lBQ3BDLENBQUMsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1FBQ3BD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RSxHQUFHLEdBQUcsQ0FBQTtRQUNWLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxDQUFDLElBQUksQ0FBQTtZQUNiLENBQUM7WUFDRCxNQUFNLFVBQVUsQ0FBQTtZQUNoQixFQUFFLEdBQUcsSUFBSSxzQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFDLENBQUMsQ0FBQTtZQUM5RCxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUM3QixDQUFDO1FBQ0QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFBO0lBQ2hELENBQUM7Q0FBQTtBQUVEO0lBQ0UsTUFBTSxDQUFDO1FBQ0wsYUFBYSxFQUFFLGlCQUFpQjtRQUNoQyx1QkFBdUIsRUFBRSwwQkFBMEI7UUFDbkQscUJBQXFCLEVBQUUsTUFBTSxtQ0FBbUM7UUFDaEUsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixjQUFjLEVBQUUsQ0FBTyxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUM7WUFDckMsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNsQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxDQUFDLEVBQUUsQ0FBQTtZQUNYLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUNwQyxDQUFDLENBQUE7S0FDRixDQUFBO0FBQ0gsQ0FBQztBQWRELGdFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDb21wb3NpdGVEaXNwb3NhYmxlfSBmcm9tICdhdG9tJ1xuaW1wb3J0IHtJZGVIYXNrZWxsUmVwbEJnfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxudHlwZSBVUElJbnRlcmZhY2UgPSBhbnlcbmxldCBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuY29uc3QgZWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbFZpZXc+ID0gbmV3IFdlYWtNYXAoKVxuY29uc3QgYmdFZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsQmc+ID0gbmV3IFdlYWtNYXAoKVxubGV0IHJlc29sdmVVUElQcm9taXNlOiAodXBpOiBVUElJbnRlcmZhY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUElJbnRlcmZhY2U+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVVUElQcm9taXNlID0gcmVzb2x2ZSB9KVxubGV0IFVQSTogVVBJSW50ZXJmYWNlXG5cbmV4cG9ydCBmdW5jdGlvbiBhY3RpdmF0ZSAoc3RhdGUpIHtcbiAgZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20ud29ya3NwYWNlLmFkZE9wZW5lcigodXJpVG9PcGVuLCBvcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCBtID0gdXJpVG9PcGVuLm1hdGNoKC9eaWRlLWhhc2tlbGw6XFwvXFwvcmVwbFxcLyguKikkLylcbiAgICAgIGlmICghKG0gJiYgbVsxXSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlUmVwbFZpZXcoe3VyaTogbVsxXX0pXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnOiBhc3luYyAoe2N1cnJlbnRUYXJnZXR9KSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYykgPT4gKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgIGNvbnN0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSlcbiAgICBpZiAodmlldykgeyB2aWV3W2Z1bmNdKCkgfVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpleGVjLWNvbW1hbmQnOiBjb21tYW5kRnVuY3Rpb24oJ2V4ZWNDb21tYW5kJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWJhY2snOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlCYWNrJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWZvcndhcmQnOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlGb3J3YXJkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHQnOiBjb21tYW5kRnVuY3Rpb24oJ2ludGVycnVwdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Y2xlYXItb3V0cHV0JzogY29tbWFuZEZ1bmN0aW9uKCdjbGVhcicpLFxuICAgIH0pLFxuICApXG5cbiAgY29uc3QgZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24gPSAoZnVuYykgPT4gKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgIG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpLCBmYWxzZSlcbiAgICAudGhlbigobW9kZWwpID0+IG1vZGVsW2Z1bmNdKCkpXG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3I6bm90KC5pZGUtaGFza2VsbC1yZXBsKScsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNvcHktc2VsZWN0aW9uLXRvLXJlcGwtaW5wdXQnOiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgICAgICBjb25zdCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBjb25zdCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQsIGZhbHNlKS50aGVuKGFzeW5jIChtb2RlbCkgPT4gbW9kZWwucnVuQ29tbWFuZChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoYXRvbS5tZW51LmFkZChbe1xuICAgIGxhYmVsOiAnSGFza2VsbCBJREUnLFxuICAgIHN1Ym1lbnU6IFt7XG4gICAgICBsYWJlbDogJ09wZW4gUkVQTCcsXG4gICAgICBjb21tYW5kOiAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnLFxuICAgIH1dLFxuICB9XSkpXG5cbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKHJlc29sdmVVUElQcm9taXNlICYmICFVUEkpIHsgcmVzb2x2ZVVQSVByb21pc2UobnVsbCkgfVxuICB9LCAgICAgICAgIDUwMDApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBsVmlldyAoe3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH06IElWaWV3U3RhdGUpIHtcbiAgY29uc3QgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcodXBpUHJvbWlzZSwge3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH0pXG4gIGVkaXRvck1hcC5zZXQodmlldy5lZGl0b3IsIHZpZXcpXG4gIHJldHVybiB2aWV3XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW4gKGVkaXRvciwgYWN0aXZhdGUgPSB0cnVlKTogUHJvbWlzZTxJZGVIYXNrZWxsUmVwbFZpZXc+IHtcbiAgY29uc3QgZ3JhbW1hciA9IGVkaXRvciA/IGVkaXRvci5nZXRHcmFtbWFyKCkgOiBudWxsXG4gIGNvbnN0IHNjb3BlID0gZ3JhbW1hciA/IGdyYW1tYXIuc2NvcGVOYW1lIDogbnVsbFxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFVSSSgpXG4gIH0gZWxzZSB7XG4gICAgdXJpID0gJydcbiAgfVxuICByZXR1cm4gYXRvbS53b3Jrc3BhY2Uub3BlbihgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dXJpfWAsIHtcbiAgICBzcGxpdDogJ3JpZ2h0JyxcbiAgICBzZWFyY2hBbGxQYW5lczogdHJ1ZSxcbiAgICBhY3RpdmF0ZVBhbmU6IGFjdGl2YXRlLFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSSAoc2VydmljZSkge1xuICBjb25zdCBkaXNwID0gc2VydmljZS5jb25zdW1lKHtcbiAgICBuYW1lOiAnaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgbWVzc2FnZVR5cGVzOiB7XG4gICAgICByZXBsOiB7XG4gICAgICAgIHVyaUZpbHRlcjogZmFsc2UsXG4gICAgICAgIGF1dG9TY3JvbGw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdG9vbHRpcEV2ZW50OiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBjb25zdW1lcjogKHVwaSkgPT4ge1xuICAgICAgVVBJID0gdXBpXG4gICAgICByZXNvbHZlVVBJUHJvbWlzZSh1cGkpXG4gICAgfSxcbiAgfSlcbiAgZGlzcG9zYWJsZXMuYWRkKGRpc3ApXG4gIHJldHVybiBkaXNwXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNob3VsZFNob3dUb29sdGlwIChlZGl0b3I6IEF0b21UeXBlcy5UZXh0RWRpdG9yLCBjcmFuZ2U6IEF0b21UeXBlcy5SYW5nZSwgdHlwZTogc3RyaW5nKSB7XG4gIGlmICghYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnNob3dUeXBlcycpKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICAvLyBUT0RPOiBtb3JlIGVmZmVjdGl2ZSBiZ0VkaXRvck1hcFxuICAvLyBzaG91bGQgaGF2ZSBvbmUgZ2hjaSBpbnN0YW5jZSBwZXIgcHJvamVjdCBjb21wb25lbnRcbiAgLy8gbm90IHBlciBmaWxlLlxuICBsZXQgYmc6IElkZUhhc2tlbGxSZXBsQmdcbiAgY29uc3QgYmd0ID0gYmdFZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgaWYgKGJndCkge1xuICAgIGJnID0gYmd0XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFlZGl0b3IuZ2V0UGF0aCgpKSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBlZGl0b3IuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoZWRpdG9yLCBiZylcbiAgfVxuICByZXR1cm4gYmcuc2hvd1R5cGVBdChlZGl0b3IuZ2V0UGF0aCgpLCBjcmFuZ2UpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdXRvY29tcGxldGVQcm92aWRlcl8zXzBfMCAoKSB7XG4gIHJldHVybiB7XG4gICAgc2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCcsXG4gICAgZGlzYWJsZUZvclNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwgLmNvbW1lbnQnLFxuICAgIGdldFRleHRFZGl0b3JTZWxlY3RvcjogKCkgPT4gJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgaW5jbHVzaW9uUHJpb3JpdHk6IDAsXG4gICAgZ2V0U3VnZ2VzdGlvbnM6IGFzeW5jICh7ZWRpdG9yLCBwcmVmaXh9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19