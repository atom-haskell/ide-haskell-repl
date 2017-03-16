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
const ide_haskell_repl_view_1 = require("./ide-haskell-repl-view");
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
            open(ed, false).then((model) => model.runCommand(cmd));
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
        consumer: (upi) => {
            UPI = upi;
            resolveUPIPromise(upi);
        },
    });
    disposables.add(disp);
    return disp;
}
exports.consumeUPI = consumeUPI;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBd0M7QUFDeEMsbUVBR2dDO0FBRWhDLDhCQUF3QjtBQUd4QixJQUFJLFdBQWdDLENBQUE7QUFDcEMsSUFBSSxTQUFTLEdBQXNELElBQUksT0FBTyxFQUFFLENBQUE7QUFDaEYsSUFBSSxpQkFBOEMsQ0FBQTtBQUNsRCxJQUFJLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBZSxDQUFDLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4RixJQUFJLEdBQWlCLENBQUE7QUFFckIsa0JBQTBCLEtBQUs7SUFDN0IsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtJQUV2QyxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBUyxFQUFFLE9BQU87UUFDMUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFBO1FBQ3ZELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sQ0FBQTtRQUNSLENBQUM7UUFDRCxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUE7SUFDcEMsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUU7UUFDcEMseUJBQXlCLEVBQUUsQ0FBTyxFQUFDLGFBQWEsRUFBQyxvREFBSyxNQUFNLENBQU4sSUFBSSxD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dCB7XG4gIElkZUhhc2tlbGxSZXBsVmlldyxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi9pZGUtaGFza2VsbC1yZXBsLXZpZXcnXG5cbmV4cG9ydCAqIGZyb20gJy4vY29uZmlnJ1xuXG50eXBlIFVQSUludGVyZmFjZSA9IGFueVxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5sZXQgZWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbFZpZXc+ID0gbmV3IFdlYWtNYXAoKVxubGV0IHJlc29sdmVVUElQcm9taXNlOiAodXBpOiBVUElJbnRlcmZhY2UpID0+IHZvaWRcbmxldCB1cGlQcm9taXNlID0gbmV3IFByb21pc2U8VVBJSW50ZXJmYWNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSUludGVyZmFjZVxuXG5leHBvcnQgZnVuY3Rpb24gYWN0aXZhdGUgKHN0YXRlKSB7XG4gIGRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLndvcmtzcGFjZS5hZGRPcGVuZXIoKHVyaVRvT3Blbiwgb3B0aW9ucykgPT4ge1xuICAgICAgbGV0IG0gPSB1cmlUb09wZW4ubWF0Y2goL15pZGUtaGFza2VsbDpcXC9cXC9yZXBsXFwvKC4qKSQvKVxuICAgICAgaWYgKCEobSAmJiBtWzFdKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHJldHVybiBjcmVhdGVSZXBsVmlldyh7dXJpOiBtWzFdfSlcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcicsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZSc6IGFzeW5jICh7Y3VycmVudFRhcmdldH0pID0+IG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKSxcbiAgICB9KSxcbiAgKVxuXG4gIGxldCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYykgPT4gKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgIGxldCB2aWV3ID0gZWRpdG9yTWFwLmdldChjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpXG4gICAgaWYgKHZpZXcpIHsgdmlld1tmdW5jXSgpIH1cbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6ZXhlYy1jb21tYW5kJzogY29tbWFuZEZ1bmN0aW9uKCdleGVjQ29tbWFuZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1iYWNrJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5QmFjaycpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1mb3J3YXJkJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5Rm9yd2FyZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0JzogY29tbWFuZEZ1bmN0aW9uKCdpbnRlcnJ1cHQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGxldCBleHRlcm5hbENvbW1hbmRGdW5jdGlvbiA9IChmdW5jKSA9PiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCksIGZhbHNlKVxuICAgIC50aGVuKChtb2RlbCkgPT4gbW9kZWxbZnVuY10oKSlcbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcjpub3QoLmlkZS1oYXNrZWxsLXJlcGwpJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Y29weS1zZWxlY3Rpb24tdG8tcmVwbC1pbnB1dCc6ICh7Y3VycmVudFRhcmdldH0pID0+IHtcbiAgICAgICAgbGV0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGxldCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQpLnRoZW4oKG1vZGVsKSA9PiBtb2RlbC5jb3B5VGV4dChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJ1bi1zZWxlY3Rpb24taW4tcmVwbCc6ICh7Y3VycmVudFRhcmdldH0pID0+IHtcbiAgICAgICAgbGV0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGxldCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQsIGZhbHNlKS50aGVuKChtb2RlbCkgPT4gbW9kZWwucnVuQ29tbWFuZChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoYXRvbS5tZW51LmFkZChbe1xuICAgIGxhYmVsOiAnSGFza2VsbCBJREUnLFxuICAgIHN1Ym1lbnU6IFt7XG4gICAgICBsYWJlbDogJ09wZW4gUkVQTCcsXG4gICAgICBjb21tYW5kOiAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnLFxuICAgIH1dLFxuICB9XSkpXG5cbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKHJlc29sdmVVUElQcm9taXNlICYmICFVUEkpIHsgcmVzb2x2ZVVQSVByb21pc2UobnVsbCkgfVxuICB9LCA1MDAwKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwbFZpZXcgKHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9OiBJVmlld1N0YXRlKSB7XG4gIGxldCB2aWV3ID0gbmV3IElkZUhhc2tlbGxSZXBsVmlldyh1cGlQcm9taXNlLCB7dXJpLCBjb250ZW50LCBoaXN0b3J5LCBhdXRvUmVsb2FkUmVwZWF0fSlcbiAgZWRpdG9yTWFwLnNldCh2aWV3LmVkaXRvciwgdmlldylcbiAgcmV0dXJuIHZpZXdcbn1cblxuYXN5bmMgZnVuY3Rpb24gb3BlbiAoZWRpdG9yLCBhY3RpdmF0ZSA9IHRydWUpIHtcbiAgbGV0IGdyYW1tYXIgPSBlZGl0b3IgPyBlZGl0b3IuZ2V0R3JhbW1hcigpIDogbnVsbFxuICBsZXQgc2NvcGUgPSBncmFtbWFyID8gZ3JhbW1hci5zY29wZU5hbWUgOiBudWxsXG4gIGxldCB1cmlcbiAgaWYgKHNjb3BlICYmIHNjb3BlLmVuZHNXaXRoKCdoYXNrZWxsJykpIHtcbiAgICB1cmkgPSBlZGl0b3IuZ2V0VVJJKClcbiAgfSBlbHNlIHtcbiAgICB1cmkgPSAnJ1xuICB9XG4gIHJldHVybiBhdG9tLndvcmtzcGFjZS5vcGVuKGBpZGUtaGFza2VsbDovL3JlcGwvJHt1cml9YCwge1xuICAgIHNwbGl0OiAncmlnaHQnLFxuICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgIGFjdGl2YXRlUGFuZTogYWN0aXZhdGUsXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWFjdGl2YXRlICgpIHtcbiAgZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lVVBJIChzZXJ2aWNlKSB7XG4gIGxldCBkaXNwID0gc2VydmljZS5jb25zdW1lKHtcbiAgICBuYW1lOiAnaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgbWVzc2FnZVR5cGVzOiB7XG4gICAgICByZXBsOiB7XG4gICAgICAgIHVyaUZpbHRlcjogZmFsc2UsXG4gICAgICAgIGF1dG9TY3JvbGw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgY29uc3VtZXI6ICh1cGkpID0+IHtcbiAgICAgIFVQSSA9IHVwaVxuICAgICAgcmVzb2x2ZVVQSVByb21pc2UodXBpKVxuICAgIH0sXG4gIH0pXG4gIGRpc3Bvc2FibGVzLmFkZChkaXNwKVxuICByZXR1cm4gZGlzcFxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiAoe2VkaXRvciwgcHJlZml4fSkgPT4ge1xuICAgICAgbGV0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgICAgIGlmICghdmlldykge1xuICAgICAgICByZXR1cm4gW11cbiAgICAgIH1cbiAgICAgIHJldHVybiB2aWV3LmdldENvbXBsZXRpb25zKHByZWZpeClcbiAgICB9LFxuICB9XG59XG4iXX0=