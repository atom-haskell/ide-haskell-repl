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
const ide_haskell_repl_base_1 = require("./ide-haskell-repl-base");
const ide_haskell_repl_bg_1 = require("./ide-haskell-repl-bg");
const ide_haskell_repl_view_1 = require("./views/ide-haskell-repl-view");
__export(require("./config"));
let disposables;
const editorMap = new WeakMap();
const bgEditorMap = new Map();
let resolveUPIPromise;
const upiPromise = new Promise((resolve) => { resolveUPIPromise = resolve; });
let UPI;
function activate() {
    disposables = new atom_1.CompositeDisposable();
    disposables.add(atom.workspace.addOpener((uriToOpen) => {
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
            resolveUPIPromise();
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
            uri = editor.getPath();
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
function consumeUPI(register) {
    UPI = register({
        name: 'ide-haskell-repl',
        messageTypes: {
            repl: {
                uriFilter: false,
                autoScroll: true,
            },
        },
        tooltip: {
            priority: 200,
            handler: shouldShowTooltip,
        },
        events: {
            onDidSaveBuffer: didSaveBuffer
        },
    });
    resolveUPIPromise(UPI);
    disposables.add(UPI);
    return UPI;
}
exports.consumeUPI = consumeUPI;
function shouldShowTooltip(editor, crange, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!atom.config.get('ide-haskell-repl.showTypes')) {
            return;
        }
        const { cwd, cabal, comp } = yield ide_haskell_repl_base_1.IdeHaskellReplBase.componentFromURI(editor.getPath());
        const hash = `${cwd.getPath()}::${cabal.name}::${comp[0]}`;
        let bg = bgEditorMap.get(hash);
        if (!bg) {
            if (!editor.getPath()) {
                return;
            }
            yield upiPromise;
            bg = new ide_haskell_repl_bg_1.IdeHaskellReplBg(upiPromise, { uri: editor.getPath() });
            bgEditorMap.set(hash, bg);
        }
        return bg.showTypeAt(editor.getPath(), crange);
    });
}
function didSaveBuffer(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!atom.config.get('ide-haskell-repl.checkOnSave')) {
            return;
        }
        const { cwd, cabal, comp } = yield ide_haskell_repl_base_1.IdeHaskellReplBase.componentFromURI(buffer.getPath());
        const hash = `${cwd.getPath()}::${cabal.name}::${comp[0]}`;
        const bgt = bgEditorMap.get(hash);
        if (bgt) {
            bgt.ghciReload();
        }
        else {
            if (!buffer.getPath()) {
                return;
            }
            yield upiPromise;
            const bg = new ide_haskell_repl_bg_1.IdeHaskellReplBg(upiPromise, { uri: buffer.getPath() });
            bgEditorMap.set(hash, bg);
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0Q7QUFDcEQsbUVBQTBEO0FBQzFELCtEQUFzRDtBQUN0RCx5RUFHc0M7QUFFdEMsOEJBQXdCO0FBRXhCLElBQUksV0FBZ0MsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBc0QsSUFBSSxPQUFPLEVBQUUsQ0FBQTtBQUNsRixNQUFNLFdBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUM1RCxJQUFJLGlCQUFtRCxDQUFBO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5RixJQUFJLEdBQWlDLENBQUE7QUFPckM7SUFDRSxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO0lBRXZDLFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUE7UUFDekQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsTUFBTSxDQUFBO1FBQ1IsQ0FBQztRQUNELE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQTtJQUNwQyxDQUFDLENBQUMsQ0FDSCxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRTtRQUNwQyx5QkFBeUIs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QUMsQ0FBQyxDQUFDO1lBQ1IsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFBO1FBQ2xCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxDQUFBO1lBQ1IsQ0FBQztZQUNELE1BQU0sVUFBVSxDQUFBO1lBQ2hCLE1BQU0sRUFBRSxHQUFHLElBQUksc0NBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBQyxDQUFDLENBQUE7WUFDcEUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDM0IsQ0FBQztJQUNILENBQUM7Q0FBQTtBQUVEO0lBQ0UsTUFBTSxDQUFDO1FBQ0wsYUFBYSxFQUFFLGlCQUFpQjtRQUNoQyx1QkFBdUIsRUFBRSwwQkFBMEI7UUFDbkQscUJBQXFCLEVBQUUsTUFBTSxtQ0FBbUM7UUFDaEUsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixjQUFjLEVBQUUsQ0FBTyxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQXVDO1lBQzNFLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDbEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNWLE1BQU0sQ0FBQyxFQUFFLENBQUE7WUFDWCxDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDcEMsQ0FBQyxDQUFBO0tBQ0YsQ0FBQTtBQUNILENBQUM7QUFkRCxnRUFjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Q29tcG9zaXRlRGlzcG9zYWJsZSwgVGV4dEVkaXRvcn0gZnJvbSAnYXRvbSdcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxCYXNlfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxCZ30gZnJvbSAnLi9pZGUtaGFza2VsbC1yZXBsLWJnJ1xuaW1wb3J0IHtcbiAgSWRlSGFza2VsbFJlcGxWaWV3LFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuZXhwb3J0ICogZnJvbSAnLi9jb25maWcnXG5cbmxldCBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuY29uc3QgZWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbFZpZXc+ID0gbmV3IFdlYWtNYXAoKVxuY29uc3QgYmdFZGl0b3JNYXA6IE1hcDxzdHJpbmcsIElkZUhhc2tlbGxSZXBsQmc+ID0gbmV3IE1hcCgpXG5sZXQgcmVzb2x2ZVVQSVByb21pc2U6ICh1cGk/OiBVUEkuSVVQSUluc3RhbmNlKSA9PiB2b2lkXG5jb25zdCB1cGlQcm9taXNlID0gbmV3IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4oKHJlc29sdmUpID0+IHsgcmVzb2x2ZVVQSVByb21pc2UgPSByZXNvbHZlIH0pXG5sZXQgVVBJOiBVUEkuSVVQSUluc3RhbmNlIHwgdW5kZWZpbmVkXG5cbmRlY2xhcmUgaW50ZXJmYWNlIElFdmVudERlc2Mge1xuICBjdXJyZW50VGFyZ2V0OiBIVE1MRWxlbWVudCAmIHsgZ2V0TW9kZWwgKCk6IEF0b21UeXBlcy5UZXh0RWRpdG9yIH1cbiAgYWJvcnRLZXlCaW5kaW5nPyAoKTogdm9pZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gYWN0aXZhdGUgKCkge1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS53b3Jrc3BhY2UuYWRkT3BlbmVyKCh1cmlUb09wZW46IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgcmV0dXJuIGNyZWF0ZVJlcGxWaWV3KHt1cmk6IG1bMV19KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4gb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpLFxuICAgIH0pLFxuICApXG5cbiAgY29uc3QgY29tbWFuZEZ1bmN0aW9uID0gKGZ1bmM6IHN0cmluZykgPT4gKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgIGNvbnN0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSlcbiAgICBpZiAodmlldykgeyB2aWV3W2Z1bmNdKCkgfVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpleGVjLWNvbW1hbmQnOiBjb21tYW5kRnVuY3Rpb24oJ2V4ZWNDb21tYW5kJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWJhY2snOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlCYWNrJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpoaXN0b3J5LWZvcndhcmQnOiBjb21tYW5kRnVuY3Rpb24oJ2hpc3RvcnlGb3J3YXJkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGNvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1pbnRlcnJ1cHQnOiBjb21tYW5kRnVuY3Rpb24oJ2ludGVycnVwdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Y2xlYXItb3V0cHV0JzogY29tbWFuZEZ1bmN0aW9uKCdjbGVhcicpLFxuICAgIH0pLFxuICApXG5cbiAgY29uc3QgZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCksIGZhbHNlKVxuICAgIC50aGVuKChtb2RlbCkgPT4gbW9kZWxbZnVuY10oKSlcbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcjpub3QoLmlkZS1oYXNrZWxsLXJlcGwpJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Y29weS1zZWxlY3Rpb24tdG8tcmVwbC1pbnB1dCc6ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICAgICAgY29uc3QgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgY29uc3QgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkKS50aGVuKChtb2RlbCkgPT4gbW9kZWwuY29weVRleHQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpydW4tc2VsZWN0aW9uLWluLXJlcGwnOiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCwgZmFsc2UpLnRoZW4oYXN5bmMgKG1vZGVsKSA9PiBtb2RlbC5ydW5Db21tYW5kKGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChhdG9tLm1lbnUuYWRkKFt7XG4gICAgbGFiZWw6ICdIYXNrZWxsIElERScsXG4gICAgc3VibWVudTogW3tcbiAgICAgIGxhYmVsOiAnT3BlbiBSRVBMJyxcbiAgICAgIGNvbW1hbmQ6ICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZScsXG4gICAgfV0sXG4gIH1dKSlcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAocmVzb2x2ZVVQSVByb21pc2UgJiYgIVVQSSkgeyByZXNvbHZlVVBJUHJvbWlzZSgpIH1cbiAgfSwgICAgICAgICA1MDAwKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwbFZpZXcgKHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9OiBJVmlld1N0YXRlKSB7XG4gIGNvbnN0IHZpZXcgPSBuZXcgSWRlSGFza2VsbFJlcGxWaWV3KHVwaVByb21pc2UsIHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuIChlZGl0b3I6IFRleHRFZGl0b3IsIGFjdGl2YXRlID0gdHJ1ZSk6IFByb21pc2U8SWRlSGFza2VsbFJlcGxWaWV3PiB7XG4gIGNvbnN0IGdyYW1tYXIgPSBlZGl0b3IgPyBlZGl0b3IuZ2V0R3JhbW1hcigpIDogbnVsbFxuICBjb25zdCBzY29wZSA9IGdyYW1tYXIgPyBncmFtbWFyLnNjb3BlTmFtZSA6IG51bGxcbiAgbGV0IHVyaVxuICBpZiAoc2NvcGUgJiYgc2NvcGUuZW5kc1dpdGgoJ2hhc2tlbGwnKSkge1xuICAgIHVyaSA9IGVkaXRvci5nZXRQYXRoKClcbiAgfSBlbHNlIHtcbiAgICB1cmkgPSAnJ1xuICB9XG4gIHJldHVybiBhdG9tLndvcmtzcGFjZS5vcGVuKGBpZGUtaGFza2VsbDovL3JlcGwvJHt1cml9YCwge1xuICAgIHNwbGl0OiAncmlnaHQnLFxuICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgIGFjdGl2YXRlUGFuZTogYWN0aXZhdGUsXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWFjdGl2YXRlICgpIHtcbiAgZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lVVBJIChyZWdpc3RlcjogVVBJLklVUElSZWdpc3RyYXRpb24pIHtcbiAgVVBJID0gcmVnaXN0ZXIoe1xuICAgIG5hbWU6ICdpZGUtaGFza2VsbC1yZXBsJyxcbiAgICBtZXNzYWdlVHlwZXM6IHtcbiAgICAgIHJlcGw6IHtcbiAgICAgICAgdXJpRmlsdGVyOiBmYWxzZSxcbiAgICAgICAgYXV0b1Njcm9sbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB0b29sdGlwOiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIG9uRGlkU2F2ZUJ1ZmZlcjogZGlkU2F2ZUJ1ZmZlclxuICAgIH0sXG4gIH0pXG4gIHJlc29sdmVVUElQcm9taXNlKFVQSSlcbiAgZGlzcG9zYWJsZXMuYWRkKFVQSSlcbiAgcmV0dXJuIFVQSVxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG91bGRTaG93VG9vbHRpcCAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IHtjd2QsIGNhYmFsLCBjb21wfSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5jb21wb25lbnRGcm9tVVJJKGVkaXRvci5nZXRQYXRoKCkpXG4gIGNvbnN0IGhhc2ggPSBgJHtjd2QuZ2V0UGF0aCgpfTo6JHtjYWJhbC5uYW1lfTo6JHtjb21wWzBdfWBcbiAgbGV0IGJnID0gYmdFZGl0b3JNYXAuZ2V0KGhhc2gpXG4gIGlmICghYmcpIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBlZGl0b3IuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoaGFzaCwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5hc3luYyBmdW5jdGlvbiBkaWRTYXZlQnVmZmVyIChidWZmZXI6IEF0b21UeXBlcy5UZXh0QnVmZmVyKSB7XG4gIGlmICghYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmNoZWNrT25TYXZlJykpIHtcbiAgICByZXR1cm5cbiAgfVxuICBjb25zdCB7Y3dkLCBjYWJhbCwgY29tcH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShidWZmZXIuZ2V0UGF0aCgpKVxuICBjb25zdCBoYXNoID0gYCR7Y3dkLmdldFBhdGgoKX06OiR7Y2FiYWwubmFtZX06OiR7Y29tcFswXX1gXG4gIGNvbnN0IGJndCA9IGJnRWRpdG9yTWFwLmdldChoYXNoKVxuICBpZiAoYmd0KSB7XG4gICAgYmd0LmdoY2lSZWxvYWQoKVxuICB9IGVsc2Uge1xuICAgIGlmICghYnVmZmVyLmdldFBhdGgoKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGF3YWl0IHVwaVByb21pc2VcbiAgICBjb25zdCBiZyA9IG5ldyBJZGVIYXNrZWxsUmVwbEJnKHVwaVByb21pc2UsIHt1cmk6IGJ1ZmZlci5nZXRQYXRoKCl9KVxuICAgIGJnRWRpdG9yTWFwLnNldChoYXNoLCBiZylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiBhc3luYyAoe2VkaXRvciwgcHJlZml4fToge2VkaXRvcjogVGV4dEVkaXRvciwgcHJlZml4OiBzdHJpbmd9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19