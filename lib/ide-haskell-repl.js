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
function createReplView(state) {
    const view = new ide_haskell_repl_view_1.IdeHaskellReplView({ upiPromise, state });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0Q7QUFDcEQsbUVBQTBEO0FBQzFELCtEQUFzRDtBQUN0RCx5RUFHc0M7QUFFdEMsOEJBQXdCO0FBRXhCLElBQUksV0FBZ0MsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBc0QsSUFBSSxPQUFPLEVBQUUsQ0FBQTtBQUNsRixNQUFNLFdBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUM1RCxJQUFJLGlCQUFtRCxDQUFBO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sT0FBTyxpQkFBaUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM5RixJQUFJLEdBQWlDLENBQUE7QUFPckM7SUFDRSxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO0lBRXZDLFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUE7UUFDekQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsTUFBTSxDQUFBO1FBQ1IsQ0FBQztRQUNELE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQTtJQUNwQyxDQUFDLENBQUMsQ0FDSCxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRTtRQUNwQyx5QkFBeUIs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O1lBQ04sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUE7WUFDUixDQUFDO1lBQ0QsTUFBTSxVQUFVLENBQUE7WUFDaEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxzQ0FBZ0IsQ0FBQyxVQUFVLEVBQUUsRUFBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFDLENBQUMsQ0FBQTtZQUNwRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUMzQixDQUFDO0lBQ0gsQ0FBQztDQUFBO0FBRUQ7SUFDRSxNQUFNLENBQUM7UUFDTCxhQUFhLEVBQUUsaUJBQWlCO1FBQ2hDLHVCQUF1QixFQUFFLDBCQUEwQjtRQUNuRCxxQkFBcUIsRUFBRSxNQUFNLG1DQUFtQztRQUNoRSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFBRSxDQUFPLEVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBdUM7WUFDM0UsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNsQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsTUFBTSxDQUFDLEVBQUUsQ0FBQTtZQUNYLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUNwQyxDQUFDLENBQUE7S0FDRixDQUFBO0FBQ0gsQ0FBQztBQWRELGdFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDb21wb3NpdGVEaXNwb3NhYmxlLCBUZXh0RWRpdG9yfSBmcm9tICdhdG9tJ1xuaW1wb3J0IHtJZGVIYXNrZWxsUmVwbEJhc2V9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuaW1wb3J0IHtJZGVIYXNrZWxsUmVwbEJnfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5jb25zdCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5jb25zdCBiZ0VkaXRvck1hcDogTWFwPHN0cmluZywgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaT86IFVQSS5JVVBJSW5zdGFuY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSS5JVVBJSW5zdGFuY2UgfCB1bmRlZmluZWRcblxuZGVjbGFyZSBpbnRlcmZhY2UgSUV2ZW50RGVzYyB7XG4gIGN1cnJlbnRUYXJnZXQ6IEhUTUxFbGVtZW50ICYgeyBnZXRNb2RlbCAoKTogQXRvbVR5cGVzLlRleHRFZGl0b3IgfVxuICBhYm9ydEtleUJpbmRpbmc/ICgpOiB2b2lkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLndvcmtzcGFjZS5hZGRPcGVuZXIoKHVyaVRvT3Blbjogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBtID0gdXJpVG9PcGVuLm1hdGNoKC9eaWRlLWhhc2tlbGw6XFwvXFwvcmVwbFxcLyguKikkLylcbiAgICAgIGlmICghKG0gJiYgbVsxXSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlUmVwbFZpZXcoe3VyaTogbVsxXX0pXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnOiBhc3luYyAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgY29uc3QgdmlldyA9IGVkaXRvck1hcC5nZXQoY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKVxuICAgIGlmICh2aWV3KSB7IHZpZXdbZnVuY10oKSB9XG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmV4ZWMtY29tbWFuZCc6IGNvbW1hbmRGdW5jdGlvbignZXhlY0NvbW1hbmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktYmFjayc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUJhY2snKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktZm9yd2FyZCc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUZvcndhcmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdCc6IGNvbW1hbmRGdW5jdGlvbignaW50ZXJydXB0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXQnOiBjb21tYW5kRnVuY3Rpb24oJ2NsZWFyJyksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBleHRlcm5hbENvbW1hbmRGdW5jdGlvbiA9IChmdW5jOiBzdHJpbmcpID0+ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSwgZmFsc2UpXG4gICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgICAgICBjb25zdCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBjb25zdCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQpLnRoZW4oKG1vZGVsKSA9PiBtb2RlbC5jb3B5VGV4dChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJ1bi1zZWxlY3Rpb24taW4tcmVwbCc6ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICAgICAgY29uc3QgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgY29uc3QgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkLCBmYWxzZSkudGhlbihhc3luYyAobW9kZWwpID0+IG1vZGVsLnJ1bkNvbW1hbmQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKGF0b20ubWVudS5hZGQoW3tcbiAgICBsYWJlbDogJ0hhc2tlbGwgSURFJyxcbiAgICBzdWJtZW51OiBbe1xuICAgICAgbGFiZWw6ICdPcGVuIFJFUEwnLFxuICAgICAgY29tbWFuZDogJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJyxcbiAgICB9XSxcbiAgfV0pKVxuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKCkgfVxuICB9LCAgICAgICAgIDUwMDApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBsVmlldyAoc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgY29uc3QgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcoe3VwaVByb21pc2UsIHN0YXRlfSlcbiAgZWRpdG9yTWFwLnNldCh2aWV3LmVkaXRvciwgdmlldylcbiAgcmV0dXJuIHZpZXdcbn1cblxuYXN5bmMgZnVuY3Rpb24gb3BlbiAoZWRpdG9yOiBUZXh0RWRpdG9yLCBhY3RpdmF0ZSA9IHRydWUpOiBQcm9taXNlPElkZUhhc2tlbGxSZXBsVmlldz4ge1xuICBjb25zdCBncmFtbWFyID0gZWRpdG9yID8gZWRpdG9yLmdldEdyYW1tYXIoKSA6IG51bGxcbiAgY29uc3Qgc2NvcGUgPSBncmFtbWFyID8gZ3JhbW1hci5zY29wZU5hbWUgOiBudWxsXG4gIGxldCB1cmlcbiAgaWYgKHNjb3BlICYmIHNjb3BlLmVuZHNXaXRoKCdoYXNrZWxsJykpIHtcbiAgICB1cmkgPSBlZGl0b3IuZ2V0UGF0aCgpXG4gIH0gZWxzZSB7XG4gICAgdXJpID0gJydcbiAgfVxuICByZXR1cm4gYXRvbS53b3Jrc3BhY2Uub3BlbihgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dXJpfWAsIHtcbiAgICBzcGxpdDogJ3JpZ2h0JyxcbiAgICBzZWFyY2hBbGxQYW5lczogdHJ1ZSxcbiAgICBhY3RpdmF0ZVBhbmU6IGFjdGl2YXRlLFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSSAocmVnaXN0ZXI6IFVQSS5JVVBJUmVnaXN0cmF0aW9uKSB7XG4gIFVQSSA9IHJlZ2lzdGVyKHtcbiAgICBuYW1lOiAnaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgbWVzc2FnZVR5cGVzOiB7XG4gICAgICByZXBsOiB7XG4gICAgICAgIHVyaUZpbHRlcjogZmFsc2UsXG4gICAgICAgIGF1dG9TY3JvbGw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdG9vbHRpcDoge1xuICAgICAgcHJpb3JpdHk6IDIwMCxcbiAgICAgIGhhbmRsZXI6IHNob3VsZFNob3dUb29sdGlwLFxuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBvbkRpZFNhdmVCdWZmZXI6IGRpZFNhdmVCdWZmZXJcbiAgICB9LFxuICB9KVxuICByZXNvbHZlVVBJUHJvbWlzZShVUEkpXG4gIGRpc3Bvc2FibGVzLmFkZChVUEkpXG4gIHJldHVybiBVUElcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvdWxkU2hvd1Rvb2x0aXAgKGVkaXRvcjogQXRvbVR5cGVzLlRleHRFZGl0b3IsIGNyYW5nZTogQXRvbVR5cGVzLlJhbmdlLCB0eXBlOiBzdHJpbmcpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuc2hvd1R5cGVzJykpIHtcbiAgICByZXR1cm5cbiAgfVxuICBjb25zdCB7Y3dkLCBjYWJhbCwgY29tcH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShlZGl0b3IuZ2V0UGF0aCgpKVxuICBjb25zdCBoYXNoID0gYCR7Y3dkLmdldFBhdGgoKX06OiR7Y2FiYWwubmFtZX06OiR7Y29tcFswXX1gXG4gIGxldCBiZyA9IGJnRWRpdG9yTWFwLmdldChoYXNoKVxuICBpZiAoIWJnKSB7XG4gICAgaWYgKCFlZGl0b3IuZ2V0UGF0aCgpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwge3VyaTogZWRpdG9yLmdldFBhdGgoKX0pXG4gICAgYmdFZGl0b3JNYXAuc2V0KGhhc2gsIGJnKVxuICB9XG4gIHJldHVybiBiZy5zaG93VHlwZUF0KGVkaXRvci5nZXRQYXRoKCksIGNyYW5nZSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGlkU2F2ZUJ1ZmZlciAoYnVmZmVyOiBBdG9tVHlwZXMuVGV4dEJ1ZmZlcikge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5jaGVja09uU2F2ZScpKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3Qge2N3ZCwgY2FiYWwsIGNvbXB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoYnVmZmVyLmdldFBhdGgoKSlcbiAgY29uc3QgaGFzaCA9IGAke2N3ZC5nZXRQYXRoKCl9Ojoke2NhYmFsLm5hbWV9Ojoke2NvbXBbMF19YFxuICBjb25zdCBiZ3QgPSBiZ0VkaXRvck1hcC5nZXQoaGFzaClcbiAgaWYgKGJndCkge1xuICAgIGJndC5naGNpUmVsb2FkKClcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWJ1ZmZlci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgY29uc3QgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBidWZmZXIuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoaGFzaCwgYmcpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF1dG9jb21wbGV0ZVByb3ZpZGVyXzNfMF8wICgpIHtcbiAgcmV0dXJuIHtcbiAgICBzY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsJyxcbiAgICBkaXNhYmxlRm9yU2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCAuY29tbWVudCcsXG4gICAgZ2V0VGV4dEVkaXRvclNlbGVjdG9yOiAoKSA9PiAnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJyxcbiAgICBpbmNsdXNpb25Qcmlvcml0eTogMCxcbiAgICBnZXRTdWdnZXN0aW9uczogYXN5bmMgKHtlZGl0b3IsIHByZWZpeH06IHtlZGl0b3I6IFRleHRFZGl0b3IsIHByZWZpeDogc3RyaW5nfSkgPT4ge1xuICAgICAgY29uc3QgdmlldyA9IGVkaXRvck1hcC5nZXQoZWRpdG9yKVxuICAgICAgaWYgKCF2aWV3KSB7XG4gICAgICAgIHJldHVybiBbXVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZpZXcuZ2V0Q29tcGxldGlvbnMocHJlZml4KVxuICAgIH0sXG4gIH1cbn1cbiJdfQ==