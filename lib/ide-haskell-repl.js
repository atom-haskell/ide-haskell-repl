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
            return undefined;
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
function createReplView(state) {
    const view = new ide_haskell_repl_view_1.IdeHaskellReplView({ upiPromise, state });
    editorMap.set(view.editor, view);
    return view;
}
exports.createReplView = createReplView;
function open(editor, activate = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const grammar = editor && editor.getGrammar();
        const scope = grammar && grammar.scopeName;
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
            onDidSaveBuffer: didSaveBuffer,
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
            return undefined;
        }
        const { cwd, cabal, comp } = yield ide_haskell_repl_base_1.IdeHaskellReplBase.componentFromURI(editor.getPath());
        const hash = `${cwd.getPath()}::${cabal.name}::${comp[0]}`;
        let bg = bgEditorMap.get(hash);
        if (!bg) {
            if (!editor.getPath()) {
                return undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBa0U7QUFDbEUsbUVBQTREO0FBQzVELCtEQUF3RDtBQUN4RCx5RUFHc0M7QUFFdEMsOEJBQXdCO0FBRXhCLElBQUksV0FBZ0MsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBc0QsSUFBSSxPQUFPLEVBQUUsQ0FBQTtBQUNsRixNQUFNLFdBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUM1RCxJQUFJLGlCQUFtRCxDQUFBO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5RixJQUFJLEdBQWlDLENBQUE7QUFFckM7SUFDRSxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO0lBRXZDLFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUE7UUFDekQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsTUFBTSxDQUFDLFNBQVMsQ0FBQTtRQUNsQixDQUFDO1FBQ0QsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0lBQ3RDLENBQUMsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1FB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QUksQ0FBQyxDQUFDO1lBQ04sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUE7WUFDUixDQUFDO1lBQ0QsTUFBTSxVQUFVLENBQUE7WUFDaEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxzQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQTtZQUN0RSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUMzQixDQUFDO0lBQ0gsQ0FBQztDQUFBO0FBRUQ7SUFDRSxNQUFNLENBQUM7UUFDTCxhQUFhLEVBQUUsaUJBQWlCO1FBQ2hDLHVCQUF1QixFQUFFLDBCQUEwQjtRQUNuRCxxQkFBcUIsRUFBRSxNQUFNLG1DQUFtQztRQUNoRSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFBRSxDQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBMEM7WUFDL0UsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNsQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxDQUFDLEVBQUUsQ0FBQTtZQUNYLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUNwQyxDQUFDLENBQUE7S0FDRixDQUFBO0FBQ0gsQ0FBQztBQWRELGdFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9zaXRlRGlzcG9zYWJsZSwgSUV2ZW50RGVzYywgVGV4dEVkaXRvciB9IGZyb20gJ2F0b20nXG5pbXBvcnQgeyBJZGVIYXNrZWxsUmVwbEJhc2UgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7IElkZUhhc2tlbGxSZXBsQmcgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5jb25zdCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5jb25zdCBiZ0VkaXRvck1hcDogTWFwPHN0cmluZywgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaT86IFVQSS5JVVBJSW5zdGFuY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSS5JVVBJSW5zdGFuY2UgfCB1bmRlZmluZWRcblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlKCkge1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS53b3Jrc3BhY2UuYWRkT3BlbmVyKCh1cmlUb09wZW46IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICAgIH1cbiAgICAgIHJldHVybiBjcmVhdGVSZXBsVmlldyh7IHVyaTogbVsxXSB9KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoeyBjdXJyZW50VGFyZ2V0IH06IElFdmVudERlc2MpID0+IHtcbiAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpXG4gICAgaWYgKHZpZXcpIHsgdmlld1tmdW5jXSgpIH1cbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6ZXhlYy1jb21tYW5kJzogY29tbWFuZEZ1bmN0aW9uKCdleGVjQ29tbWFuZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1iYWNrJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5QmFjaycpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1mb3J3YXJkJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5Rm9yd2FyZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0JzogY29tbWFuZEZ1bmN0aW9uKCdpbnRlcnJ1cHQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNsZWFyLW91dHB1dCc6IGNvbW1hbmRGdW5jdGlvbignY2xlYXInKSxcbiAgICB9KSxcbiAgKVxuXG4gIGNvbnN0IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uID0gKGZ1bmM6IHN0cmluZykgPT4gKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCksIGZhbHNlKVxuICAgICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCwgZmFsc2UpLnRoZW4oYXN5bmMgKG1vZGVsKSA9PiBtb2RlbC5ydW5Db21tYW5kKGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChhdG9tLm1lbnUuYWRkKFt7XG4gICAgbGFiZWw6ICdIYXNrZWxsIElERScsXG4gICAgc3VibWVudTogW3tcbiAgICAgIGxhYmVsOiAnT3BlbiBSRVBMJyxcbiAgICAgIGNvbW1hbmQ6ICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZScsXG4gICAgfV0sXG4gIH1dKSlcblxuICBzZXRUaW1lb3V0KFxuICAgICgpID0+IHtcbiAgICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKCkgfVxuICAgIH0sXG4gICAgNTAwMCxcbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwbFZpZXcoc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgY29uc3QgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcoeyB1cGlQcm9taXNlLCBzdGF0ZSB9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuKGVkaXRvcjogVGV4dEVkaXRvciwgYWN0aXZhdGUgPSB0cnVlKTogUHJvbWlzZTxJZGVIYXNrZWxsUmVwbFZpZXc+IHtcbiAgY29uc3QgZ3JhbW1hciA9IGVkaXRvciAmJiBlZGl0b3IuZ2V0R3JhbW1hcigpXG4gIGNvbnN0IHNjb3BlID0gZ3JhbW1hciAmJiBncmFtbWFyLnNjb3BlTmFtZVxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFBhdGgoKVxuICB9IGVsc2Uge1xuICAgIHVyaSA9ICcnXG4gIH1cbiAgcmV0dXJuIGF0b20ud29ya3NwYWNlLm9wZW4oYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3VyaX1gLCB7XG4gICAgc3BsaXQ6ICdyaWdodCcsXG4gICAgc2VhcmNoQWxsUGFuZXM6IHRydWUsXG4gICAgYWN0aXZhdGVQYW5lOiBhY3RpdmF0ZSxcbiAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlYWN0aXZhdGUoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSShyZWdpc3RlcjogVVBJLklVUElSZWdpc3RyYXRpb24pIHtcbiAgVVBJID0gcmVnaXN0ZXIoe1xuICAgIG5hbWU6ICdpZGUtaGFza2VsbC1yZXBsJyxcbiAgICBtZXNzYWdlVHlwZXM6IHtcbiAgICAgIHJlcGw6IHtcbiAgICAgICAgdXJpRmlsdGVyOiBmYWxzZSxcbiAgICAgICAgYXV0b1Njcm9sbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB0b29sdGlwOiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIG9uRGlkU2F2ZUJ1ZmZlcjogZGlkU2F2ZUJ1ZmZlcixcbiAgICB9LFxuICB9KVxuICByZXNvbHZlVVBJUHJvbWlzZShVUEkpXG4gIGRpc3Bvc2FibGVzLmFkZChVUEkpXG4gIHJldHVybiBVUElcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvdWxkU2hvd1Rvb2x0aXAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuICBjb25zdCB7IGN3ZCwgY2FiYWwsIGNvbXAgfSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5jb21wb25lbnRGcm9tVVJJKGVkaXRvci5nZXRQYXRoKCkpXG4gIGNvbnN0IGhhc2ggPSBgJHtjd2QuZ2V0UGF0aCgpfTo6JHtjYWJhbC5uYW1lfTo6JHtjb21wWzBdfWBcbiAgbGV0IGJnID0gYmdFZGl0b3JNYXAuZ2V0KGhhc2gpXG4gIGlmICghYmcpIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwgeyB1cmk6IGVkaXRvci5nZXRQYXRoKCkgfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoaGFzaCwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5hc3luYyBmdW5jdGlvbiBkaWRTYXZlQnVmZmVyKGJ1ZmZlcjogQXRvbVR5cGVzLlRleHRCdWZmZXIpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2hlY2tPblNhdmUnKSkge1xuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IHsgY3dkLCBjYWJhbCwgY29tcCB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoYnVmZmVyLmdldFBhdGgoKSlcbiAgY29uc3QgaGFzaCA9IGAke2N3ZC5nZXRQYXRoKCl9Ojoke2NhYmFsLm5hbWV9Ojoke2NvbXBbMF19YFxuICBjb25zdCBiZ3QgPSBiZ0VkaXRvck1hcC5nZXQoaGFzaClcbiAgaWYgKGJndCkge1xuICAgIGJndC5naGNpUmVsb2FkKClcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWJ1ZmZlci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgY29uc3QgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7IHVyaTogYnVmZmVyLmdldFBhdGgoKSB9KVxuICAgIGJnRWRpdG9yTWFwLnNldChoYXNoLCBiZylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAoKSB7XG4gIHJldHVybiB7XG4gICAgc2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCcsXG4gICAgZGlzYWJsZUZvclNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwgLmNvbW1lbnQnLFxuICAgIGdldFRleHRFZGl0b3JTZWxlY3RvcjogKCkgPT4gJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgaW5jbHVzaW9uUHJpb3JpdHk6IDAsXG4gICAgZ2V0U3VnZ2VzdGlvbnM6IGFzeW5jICh7IGVkaXRvciwgcHJlZml4IH06IHsgZWRpdG9yOiBUZXh0RWRpdG9yLCBwcmVmaXg6IHN0cmluZyB9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19