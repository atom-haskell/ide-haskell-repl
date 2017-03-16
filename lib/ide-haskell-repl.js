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
const ide_haskell_repl_view_1 = require("./views/ide-haskell-repl-view");
__export(require("./config"));
let disposables;
let editorMap = new WeakMap();
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
        let view = yield open(editor, false);
        return view.showTypeAt(editor.getPath(), crange);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBd0M7QUFDeEMseUVBR3NDO0FBRXRDLDhCQUF3QjtBQUd4QixJQUFJLFdBQWdDLENBQUE7QUFDcEMsSUFBSSxTQUFTLEdBQXNELElBQUksT0FBTyxFQUFFLENBQUE7QUFDaEYsSUFBSSxpQkFBOEMsQ0FBQTtBQUNsRCxJQUFJLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBZSxDQUFDLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4RixJQUFJLEdBQWlCLENBQUE7QUFFckIsa0JBQTBCLEtBQUs7SUFDN0IsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtJQUV2QyxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxFQUFFLE9BQU87UUFDMUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO1FBQ3ZELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sQ0FBQTtRQUNSLENBQUM7UUFDRCxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUE7SUFDcEMsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUU7UUFDcEMseUJBQXlCLEVBQUUsQ0FBTyxFQUFDLGFBQWEsRUFBQyxvREFBSyxNQUFNLENBQU4sSUFBSSxD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QUNuRCxxQkFBcUIsRUFBRSxNQUFNLG1DQUFtQztRQUNoRSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFBRSxDQUFDLEVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBQztZQUMvQixJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ2hDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDVixNQUFNLENBQUMsRUFBRSxDQUFBO1lBQ1gsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUM7S0FDRixDQUFBO0FBQ0gsQ0FBQztBQWRELGdFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDb21wb3NpdGVEaXNwb3NhYmxlfSBmcm9tICdhdG9tJ1xuaW1wb3J0IHtcbiAgSWRlSGFza2VsbFJlcGxWaWV3LFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuZXhwb3J0ICogZnJvbSAnLi9jb25maWcnXG5cbnR5cGUgVVBJSW50ZXJmYWNlID0gYW55XG5sZXQgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbmxldCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5sZXQgcmVzb2x2ZVVQSVByb21pc2U6ICh1cGk6IFVQSUludGVyZmFjZSkgPT4gdm9pZFxubGV0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUElJbnRlcmZhY2U+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVVUElQcm9taXNlID0gcmVzb2x2ZSB9KVxubGV0IFVQSTogVVBJSW50ZXJmYWNlXG5cbmV4cG9ydCBmdW5jdGlvbiBhY3RpdmF0ZSAoc3RhdGUpIHtcbiAgZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20ud29ya3NwYWNlLmFkZE9wZW5lcigodXJpVG9PcGVuLCBvcHRpb25zKSA9PiB7XG4gICAgICBsZXQgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgcmV0dXJuIGNyZWF0ZVJlcGxWaWV3KHt1cmk6IG1bMV19KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHtjdXJyZW50VGFyZ2V0fSkgPT4gb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpLFxuICAgIH0pLFxuICApXG5cbiAgbGV0IGNvbW1hbmRGdW5jdGlvbiA9IChmdW5jKSA9PiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgbGV0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSlcbiAgICBpZiAodmlldykgeyB2aWV3W2Z1bmNdKCkgfVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpleGVjLWNvbW1hbmQnOiBjb21tYW5kRnVuY3Rpb24oJ2V4ZWNDb21tYW5kJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWJhY2snOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlCYWNrJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWZvcndhcmQnOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlGb3J3YXJkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHQnOiBjb21tYW5kRnVuY3Rpb24oJ2ludGVycnVwdCcpLFxuICAgIH0pLFxuICApXG5cbiAgbGV0IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uID0gKGZ1bmMpID0+ICh7Y3VycmVudFRhcmdldH0pID0+IHtcbiAgICBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSwgZmFsc2UpXG4gICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgICAgICBsZXQgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgbGV0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgICAgICBsZXQgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgbGV0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCwgZmFsc2UpLnRoZW4oYXN5bmMgKG1vZGVsKSA9PiBtb2RlbC5ydW5Db21tYW5kKGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChhdG9tLm1lbnUuYWRkKFt7XG4gICAgbGFiZWw6ICdIYXNrZWxsIElERScsXG4gICAgc3VibWVudTogW3tcbiAgICAgIGxhYmVsOiAnT3BlbiBSRVBMJyxcbiAgICAgIGNvbW1hbmQ6ICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZScsXG4gICAgfV0sXG4gIH1dKSlcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAocmVzb2x2ZVVQSVByb21pc2UgJiYgIVVQSSkgeyByZXNvbHZlVVBJUHJvbWlzZShudWxsKSB9XG4gIH0sIDUwMDApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBsVmlldyAoe3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH06IElWaWV3U3RhdGUpIHtcbiAgbGV0IHZpZXcgPSBuZXcgSWRlSGFza2VsbFJlcGxWaWV3KHVwaVByb21pc2UsIHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuIChlZGl0b3IsIGFjdGl2YXRlID0gdHJ1ZSk6IFByb21pc2U8SWRlSGFza2VsbFJlcGxWaWV3PiB7XG4gIGxldCBncmFtbWFyID0gZWRpdG9yID8gZWRpdG9yLmdldEdyYW1tYXIoKSA6IG51bGxcbiAgbGV0IHNjb3BlID0gZ3JhbW1hciA/IGdyYW1tYXIuc2NvcGVOYW1lIDogbnVsbFxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFVSSSgpXG4gIH0gZWxzZSB7XG4gICAgdXJpID0gJydcbiAgfVxuICByZXR1cm4gYXRvbS53b3Jrc3BhY2Uub3BlbihgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dXJpfWAsIHtcbiAgICBzcGxpdDogJ3JpZ2h0JyxcbiAgICBzZWFyY2hBbGxQYW5lczogdHJ1ZSxcbiAgICBhY3RpdmF0ZVBhbmU6IGFjdGl2YXRlLFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSSAoc2VydmljZSkge1xuICBsZXQgZGlzcCA9IHNlcnZpY2UuY29uc3VtZSh7XG4gICAgbmFtZTogJ2lkZS1oYXNrZWxsLXJlcGwnLFxuICAgIG1lc3NhZ2VUeXBlczoge1xuICAgICAgcmVwbDoge1xuICAgICAgICB1cmlGaWx0ZXI6IGZhbHNlLFxuICAgICAgICBhdXRvU2Nyb2xsOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRvb2x0aXBFdmVudDoge1xuICAgICAgcHJpb3JpdHk6IDIwMCxcbiAgICAgIGhhbmRsZXI6IHNob3VsZFNob3dUb29sdGlwLFxuICAgIH0sXG4gICAgY29uc3VtZXI6ICh1cGkpID0+IHtcbiAgICAgIFVQSSA9IHVwaVxuICAgICAgcmVzb2x2ZVVQSVByb21pc2UodXBpKVxuICAgIH0sXG4gIH0pXG4gIGRpc3Bvc2FibGVzLmFkZChkaXNwKVxuICByZXR1cm4gZGlzcFxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG91bGRTaG93VG9vbHRpcCAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgbGV0IHZpZXcgPSBhd2FpdCBvcGVuKGVkaXRvciwgZmFsc2UpXG4gIHJldHVybiB2aWV3LnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiAoe2VkaXRvciwgcHJlZml4fSkgPT4ge1xuICAgICAgbGV0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgICAgIGlmICghdmlldykge1xuICAgICAgICByZXR1cm4gW11cbiAgICAgIH1cbiAgICAgIHJldHVybiB2aWV3LmdldENvbXBsZXRpb25zKHByZWZpeClcbiAgICB9LFxuICB9XG59XG4iXX0=