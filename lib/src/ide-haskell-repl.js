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
let editorMap = new WeakMap();
let bgEditorMap = new WeakMap();
let resolveUPIPromise;
let upiPromise = new Promise((resolve) => { resolveUPIPromise = resolve; });
let UPI;
function activate(state) {
    disposables = new atom_1.CompositeDisposable();
    disposables.add(atom.workspace.addOpener((uriToOpen, options) => {
        let m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/);
        if (!(m && m[1])) {
            return;
        }
        return createReplView({ uri: m[1] });
    }));
    disposables.add(atom.commands.add('atom-text-editor', {
        'ide-haskell-repl:toggle': ({ currentTarget }) => __awaiter(this, void 0, void 0, function* () { return open(currentTarget.getModel()); }),
    }));
    let commandFunction = (func) => ({ currentTarget }) => {
        let view = editorMap.get(currentTarget.getModel());
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
    }));
    let externalCommandFunction = (func) => ({ currentTarget }) => {
        open(currentTarget.getModel(), false)
            .then((model) => model[func]());
    };
    disposables.add(atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
        'ide-haskell-repl:copy-selection-to-repl-input': ({ currentTarget }) => {
            let ed = currentTarget.getModel();
            let cmd = ed.getLastSelection().getText();
            open(ed).then((model) => model.copyText(cmd));
        },
        'ide-haskell-repl:run-selection-in-repl': ({ currentTarget }) => {
            let ed = currentTarget.getModel();
            let cmd = ed.getLastSelection().getText();
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
    let view = new ide_haskell_repl_view_1.IdeHaskellReplView(upiPromise, { uri, content, history, autoReloadRepeat });
    editorMap.set(view.editor, view);
    return view;
}
exports.createReplView = createReplView;
function open(editor, activate = true) {
    return __awaiter(this, void 0, void 0, function* () {
        let grammar = editor ? editor.getGrammar() : null;
        let scope = grammar ? grammar.scopeName : null;
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
    let disp = service.consume({
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
        if (bgEditorMap.has(editor)) {
            bg = bgEditorMap.get(editor);
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
        getSuggestions: ({ editor, prefix }) => {
            let view = editorMap.get(editor);
            if (!view) {
                return [];
            }
            return view.getCompletions(prefix);
        },
    };
}
exports.autocompleteProvider_3_0_0 = autocompleteProvider_3_0_0;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBd0M7QUFDeEMsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFHeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLElBQUksU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2hGLElBQUksV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2hGLElBQUksaUJBQThDLENBQUE7QUFDbEQsSUFBSSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLE9BQU8saUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEYsSUFBSSxHQUFpQixDQUFBO0FBRXJCLGtCQUEwQixLQUFLO0lBQzdCLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7SUFFdkMsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPO1FBQzFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN2RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUE7UUFDUixDQUFDO1FBQ0QsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFBO0lBQ3BDLENBQUMsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1FB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QyxDQUFDO1lBQ04sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUMsSUFBSSxDQUFBO1lBQ2IsQ0FBQztZQUNELE1BQU0sVUFBVSxDQUFBO1lBQ2hCLEVBQUUsR0FBRyxJQUFJLHNDQUFnQixDQUFDLFVBQVUsRUFBRSxFQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUMsQ0FBQyxDQUFBO1lBQzlELFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBQzdCLENBQUM7UUFDRCxNQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUE7SUFDaEQsQ0FBQztDQUFBO0FBRUQ7SUFDRSxNQUFNLENBQUM7UUFDTCxhQUFhLEVBQUUsaUJBQWlCO1FBQ2hDLHVCQUF1QixFQUFFLDBCQUEwQjtRQUNuRCxxQkFBcUIsRUFBRSxNQUFNLG1DQUFtQztRQUNoRSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFBRSxDQUFDLEVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBQztZQUMvQixJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ2hDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDVixNQUFNLENBQUMsRUFBRSxDQUFBO1lBQ1gsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUM7S0FDRixDQUFBO0FBQ0gsQ0FBQztBQWRELGdFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDb21wb3NpdGVEaXNwb3NhYmxlfSBmcm9tICdhdG9tJ1xuaW1wb3J0IHtJZGVIYXNrZWxsUmVwbEJnfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxudHlwZSBVUElJbnRlcmZhY2UgPSBhbnlcbmxldCBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxubGV0IGVkaXRvck1hcDogV2Vha01hcDxBdG9tVHlwZXMuVGV4dEVkaXRvciwgSWRlSGFza2VsbFJlcGxWaWV3PiA9IG5ldyBXZWFrTWFwKClcbmxldCBiZ0VkaXRvck1hcDogV2Vha01hcDxBdG9tVHlwZXMuVGV4dEVkaXRvciwgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgV2Vha01hcCgpXG5sZXQgcmVzb2x2ZVVQSVByb21pc2U6ICh1cGk6IFVQSUludGVyZmFjZSkgPT4gdm9pZFxubGV0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUElJbnRlcmZhY2U+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVVUElQcm9taXNlID0gcmVzb2x2ZSB9KVxubGV0IFVQSTogVVBJSW50ZXJmYWNlXG5cbmV4cG9ydCBmdW5jdGlvbiBhY3RpdmF0ZSAoc3RhdGUpIHtcbiAgZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20ud29ya3NwYWNlLmFkZE9wZW5lcigodXJpVG9PcGVuLCBvcHRpb25zKSA9PiB7XG4gICAgICBsZXQgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgcmV0dXJuIGNyZWF0ZVJlcGxWaWV3KHt1cmk6IG1bMV19KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHtjdXJyZW50VGFyZ2V0fSkgPT4gb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpLFxuICAgIH0pLFxuICApXG5cbiAgbGV0IGNvbW1hbmRGdW5jdGlvbiA9IChmdW5jKSA9PiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgbGV0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSlcbiAgICBpZiAodmlldykgeyB2aWV3W2Z1bmNdKCkgfVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpleGVjLWNvbW1hbmQnOiBjb21tYW5kRnVuY3Rpb24oJ2V4ZWNDb21tYW5kJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWJhY2snOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlCYWNrJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWZvcndhcmQnOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlGb3J3YXJkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHQnOiBjb21tYW5kRnVuY3Rpb24oJ2ludGVycnVwdCcpLFxuICAgIH0pLFxuICApXG5cbiAgbGV0IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uID0gKGZ1bmMpID0+ICh7Y3VycmVudFRhcmdldH0pID0+IHtcbiAgICBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSwgZmFsc2UpXG4gICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgICAgICBsZXQgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgbGV0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgICAgICBsZXQgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgbGV0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCwgZmFsc2UpLnRoZW4oYXN5bmMgKG1vZGVsKSA9PiBtb2RlbC5ydW5Db21tYW5kKGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChhdG9tLm1lbnUuYWRkKFt7XG4gICAgbGFiZWw6ICdIYXNrZWxsIElERScsXG4gICAgc3VibWVudTogW3tcbiAgICAgIGxhYmVsOiAnT3BlbiBSRVBMJyxcbiAgICAgIGNvbW1hbmQ6ICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZScsXG4gICAgfV0sXG4gIH1dKSlcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAocmVzb2x2ZVVQSVByb21pc2UgJiYgIVVQSSkgeyByZXNvbHZlVVBJUHJvbWlzZShudWxsKSB9XG4gIH0sIDUwMDApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBsVmlldyAoe3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH06IElWaWV3U3RhdGUpIHtcbiAgbGV0IHZpZXcgPSBuZXcgSWRlSGFza2VsbFJlcGxWaWV3KHVwaVByb21pc2UsIHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuIChlZGl0b3IsIGFjdGl2YXRlID0gdHJ1ZSk6IFByb21pc2U8SWRlSGFza2VsbFJlcGxWaWV3PiB7XG4gIGxldCBncmFtbWFyID0gZWRpdG9yID8gZWRpdG9yLmdldEdyYW1tYXIoKSA6IG51bGxcbiAgbGV0IHNjb3BlID0gZ3JhbW1hciA/IGdyYW1tYXIuc2NvcGVOYW1lIDogbnVsbFxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFVSSSgpXG4gIH0gZWxzZSB7XG4gICAgdXJpID0gJydcbiAgfVxuICByZXR1cm4gYXRvbS53b3Jrc3BhY2Uub3BlbihgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dXJpfWAsIHtcbiAgICBzcGxpdDogJ3JpZ2h0JyxcbiAgICBzZWFyY2hBbGxQYW5lczogdHJ1ZSxcbiAgICBhY3RpdmF0ZVBhbmU6IGFjdGl2YXRlLFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSSAoc2VydmljZSkge1xuICBsZXQgZGlzcCA9IHNlcnZpY2UuY29uc3VtZSh7XG4gICAgbmFtZTogJ2lkZS1oYXNrZWxsLXJlcGwnLFxuICAgIG1lc3NhZ2VUeXBlczoge1xuICAgICAgcmVwbDoge1xuICAgICAgICB1cmlGaWx0ZXI6IGZhbHNlLFxuICAgICAgICBhdXRvU2Nyb2xsOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRvb2x0aXBFdmVudDoge1xuICAgICAgcHJpb3JpdHk6IDIwMCxcbiAgICAgIGhhbmRsZXI6IHNob3VsZFNob3dUb29sdGlwLFxuICAgIH0sXG4gICAgY29uc3VtZXI6ICh1cGkpID0+IHtcbiAgICAgIFVQSSA9IHVwaVxuICAgICAgcmVzb2x2ZVVQSVByb21pc2UodXBpKVxuICAgIH0sXG4gIH0pXG4gIGRpc3Bvc2FibGVzLmFkZChkaXNwKVxuICByZXR1cm4gZGlzcFxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG91bGRTaG93VG9vbHRpcCAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgbGV0IGJnOiBJZGVIYXNrZWxsUmVwbEJnXG4gIGlmIChiZ0VkaXRvck1hcC5oYXMoZWRpdG9yKSkge1xuICAgIGJnID0gYmdFZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGF3YWl0IHVwaVByb21pc2VcbiAgICBiZyA9IG5ldyBJZGVIYXNrZWxsUmVwbEJnKHVwaVByb21pc2UsIHt1cmk6IGVkaXRvci5nZXRQYXRoKCl9KVxuICAgIGJnRWRpdG9yTWFwLnNldChlZGl0b3IsIGJnKVxuICB9XG4gIHJldHVybiBiZy5zaG93VHlwZUF0KGVkaXRvci5nZXRQYXRoKCksIGNyYW5nZSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF1dG9jb21wbGV0ZVByb3ZpZGVyXzNfMF8wICgpIHtcbiAgcmV0dXJuIHtcbiAgICBzY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsJyxcbiAgICBkaXNhYmxlRm9yU2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCAuY29tbWVudCcsXG4gICAgZ2V0VGV4dEVkaXRvclNlbGVjdG9yOiAoKSA9PiAnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJyxcbiAgICBpbmNsdXNpb25Qcmlvcml0eTogMCxcbiAgICBnZXRTdWdnZXN0aW9uczogKHtlZGl0b3IsIHByZWZpeH0pID0+IHtcbiAgICAgIGxldCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19