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
        const hash = `${cwd.getPath()}::${cabal && cabal.name}::${comp && comp[0]}`;
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
        const hash = `${cwd.getPath()}::${cabal && cabal.name}::${comp && comp[0]}`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBa0U7QUFDbEUsbUVBQTREO0FBQzVELCtEQUF3RDtBQUN4RCx5RUFHc0M7QUFFdEMsOEJBQXdCO0FBRXhCLElBQUksV0FBZ0MsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBc0QsSUFBSSxPQUFPLEVBQUUsQ0FBQTtBQUNsRixNQUFNLFdBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUM1RCxJQUFJLGlCQUFtRCxDQUFBO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsaUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUYsSUFBSSxHQUFpQyxDQUFBO0FBRXJDO0lBQ0UsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtJQUV2QyxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBaUIsRUFBRSxFQUFFO1FBQzdDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN6RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUMsU0FBUyxDQUFBO1FBQ2xCLENBQUM7UUFDRCxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7SUFDdEMsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFH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bnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9zaXRlRGlzcG9zYWJsZSwgSUV2ZW50RGVzYywgVGV4dEVkaXRvciB9IGZyb20gJ2F0b20nXG5pbXBvcnQgeyBJZGVIYXNrZWxsUmVwbEJhc2UgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7IElkZUhhc2tlbGxSZXBsQmcgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5jb25zdCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5jb25zdCBiZ0VkaXRvck1hcDogTWFwPHN0cmluZywgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaT86IFVQSS5JVVBJSW5zdGFuY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSS5JVVBJSW5zdGFuY2UgfCB1bmRlZmluZWRcblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlKCkge1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS53b3Jrc3BhY2UuYWRkT3BlbmVyKCh1cmlUb09wZW46IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICAgIH1cbiAgICAgIHJldHVybiBjcmVhdGVSZXBsVmlldyh7IHVyaTogbVsxXSB9KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoeyBjdXJyZW50VGFyZ2V0IH06IElFdmVudERlc2MpID0+IHtcbiAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpXG4gICAgaWYgKHZpZXcpIHsgKHZpZXdbZnVuY10gYXMgKCkgPT4gdm9pZCkoKSB9XG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmV4ZWMtY29tbWFuZCc6IGNvbW1hbmRGdW5jdGlvbignZXhlY0NvbW1hbmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktYmFjayc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUJhY2snKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktZm9yd2FyZCc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUZvcndhcmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdCc6IGNvbW1hbmRGdW5jdGlvbignaW50ZXJydXB0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXQnOiBjb21tYW5kRnVuY3Rpb24oJ2NsZWFyJyksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBleHRlcm5hbENvbW1hbmRGdW5jdGlvbiA9IChmdW5jOiBzdHJpbmcpID0+ICh7IGN1cnJlbnRUYXJnZXQgfTogSUV2ZW50RGVzYykgPT4ge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1mbG9hdGluZy1wcm9taXNlc1xuICAgIG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpLCBmYWxzZSlcbiAgICAgIC50aGVuKChtb2RlbCkgPT4gKG1vZGVsW2Z1bmNdIGFzICgpID0+IHZvaWQpKCkpXG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3I6bm90KC5pZGUtaGFza2VsbC1yZXBsKScsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNvcHktc2VsZWN0aW9uLXRvLXJlcGwtaW5wdXQnOiAoeyBjdXJyZW50VGFyZ2V0IH06IElFdmVudERlc2MpID0+IHtcbiAgICAgICAgY29uc3QgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgY29uc3QgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tZmxvYXRpbmctcHJvbWlzZXNcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgICAgIG9wZW4oZWQsIGZhbHNlKS50aGVuKGFzeW5jIChtb2RlbCkgPT4gbW9kZWwucnVuQ29tbWFuZChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoYXRvbS5tZW51LmFkZChbe1xuICAgIGxhYmVsOiAnSGFza2VsbCBJREUnLFxuICAgIHN1Ym1lbnU6IFt7XG4gICAgICBsYWJlbDogJ09wZW4gUkVQTCcsXG4gICAgICBjb21tYW5kOiAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnLFxuICAgIH1dLFxuICB9XSkpXG5cbiAgc2V0VGltZW91dChcbiAgICAoKSA9PiB7XG4gICAgICBpZiAocmVzb2x2ZVVQSVByb21pc2UgJiYgIVVQSSkgeyByZXNvbHZlVVBJUHJvbWlzZSgpIH1cbiAgICB9LFxuICAgIDUwMDAsXG4gIClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlcGxWaWV3KHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gIGNvbnN0IHZpZXcgPSBuZXcgSWRlSGFza2VsbFJlcGxWaWV3KHsgdXBpUHJvbWlzZSwgc3RhdGUgfSlcbiAgZWRpdG9yTWFwLnNldCh2aWV3LmVkaXRvciwgdmlldylcbiAgcmV0dXJuIHZpZXdcbn1cblxuYXN5bmMgZnVuY3Rpb24gb3BlbihlZGl0b3I6IFRleHRFZGl0b3IsIGFjdGl2YXRlID0gdHJ1ZSk6IFByb21pc2U8SWRlSGFza2VsbFJlcGxWaWV3PiB7XG4gIGNvbnN0IGdyYW1tYXIgPSBlZGl0b3IgJiYgZWRpdG9yLmdldEdyYW1tYXIoKVxuICBjb25zdCBzY29wZSA9IGdyYW1tYXIgJiYgZ3JhbW1hci5zY29wZU5hbWVcbiAgbGV0IHVyaVxuICBpZiAoc2NvcGUgJiYgc2NvcGUuZW5kc1dpdGgoJ2hhc2tlbGwnKSkge1xuICAgIHVyaSA9IGVkaXRvci5nZXRQYXRoKClcbiAgfSBlbHNlIHtcbiAgICB1cmkgPSAnJ1xuICB9XG4gIHJldHVybiBhdG9tLndvcmtzcGFjZS5vcGVuKGBpZGUtaGFza2VsbDovL3JlcGwvJHt1cml9YCwge1xuICAgIHNwbGl0OiAncmlnaHQnLFxuICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgIGFjdGl2YXRlUGFuZTogYWN0aXZhdGUsXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWFjdGl2YXRlKCkge1xuICBkaXNwb3NhYmxlcy5kaXNwb3NlKClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVVUEkocmVnaXN0ZXI6IFVQSS5JVVBJUmVnaXN0cmF0aW9uKSB7XG4gIFVQSSA9IHJlZ2lzdGVyKHtcbiAgICBuYW1lOiAnaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgbWVzc2FnZVR5cGVzOiB7XG4gICAgICByZXBsOiB7XG4gICAgICAgIHVyaUZpbHRlcjogZmFsc2UsXG4gICAgICAgIGF1dG9TY3JvbGw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdG9vbHRpcDoge1xuICAgICAgcHJpb3JpdHk6IDIwMCxcbiAgICAgIGhhbmRsZXI6IHNob3VsZFNob3dUb29sdGlwLFxuICAgIH0sXG4gICAgZXZlbnRzOiB7XG4gICAgICBvbkRpZFNhdmVCdWZmZXI6IGRpZFNhdmVCdWZmZXIsXG4gICAgfSxcbiAgfSlcbiAgcmVzb2x2ZVVQSVByb21pc2UoVVBJKVxuICBkaXNwb3NhYmxlcy5hZGQoVVBJKVxuICByZXR1cm4gVVBJXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNob3VsZFNob3dUb29sdGlwKGVkaXRvcjogQXRvbVR5cGVzLlRleHRFZGl0b3IsIGNyYW5nZTogQXRvbVR5cGVzLlJhbmdlLCB0eXBlOiBzdHJpbmcpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuc2hvd1R5cGVzJykpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cbiAgY29uc3QgeyBjd2QsIGNhYmFsLCBjb21wIH0gPSBhd2FpdCBJZGVIYXNrZWxsUmVwbEJhc2UuY29tcG9uZW50RnJvbVVSSShlZGl0b3IuZ2V0UGF0aCgpKVxuICBjb25zdCBoYXNoID0gYCR7Y3dkLmdldFBhdGgoKX06OiR7Y2FiYWwgJiYgY2FiYWwubmFtZX06OiR7Y29tcCAmJiBjb21wWzBdfWBcbiAgbGV0IGJnID0gYmdFZGl0b3JNYXAuZ2V0KGhhc2gpXG4gIGlmICghYmcpIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwgeyB1cmk6IGVkaXRvci5nZXRQYXRoKCkgfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoaGFzaCwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5hc3luYyBmdW5jdGlvbiBkaWRTYXZlQnVmZmVyKGJ1ZmZlcjogQXRvbVR5cGVzLlRleHRCdWZmZXIpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2hlY2tPblNhdmUnKSkge1xuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IHsgY3dkLCBjYWJhbCwgY29tcCB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoYnVmZmVyLmdldFBhdGgoKSlcbiAgY29uc3QgaGFzaCA9IGAke2N3ZC5nZXRQYXRoKCl9Ojoke2NhYmFsICYmIGNhYmFsLm5hbWV9Ojoke2NvbXAgJiYgY29tcFswXX1gXG4gIGNvbnN0IGJndCA9IGJnRWRpdG9yTWFwLmdldChoYXNoKVxuICBpZiAoYmd0KSB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWZsb2F0aW5nLXByb21pc2VzXG4gICAgYmd0LmdoY2lSZWxvYWQoKVxuICB9IGVsc2Uge1xuICAgIGlmICghYnVmZmVyLmdldFBhdGgoKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGF3YWl0IHVwaVByb21pc2VcbiAgICBjb25zdCBiZyA9IG5ldyBJZGVIYXNrZWxsUmVwbEJnKHVwaVByb21pc2UsIHsgdXJpOiBidWZmZXIuZ2V0UGF0aCgpIH0pXG4gICAgYmdFZGl0b3JNYXAuc2V0KGhhc2gsIGJnKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdXRvY29tcGxldGVQcm92aWRlcl8zXzBfMCgpIHtcbiAgcmV0dXJuIHtcbiAgICBzY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsJyxcbiAgICBkaXNhYmxlRm9yU2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCAuY29tbWVudCcsXG4gICAgZ2V0VGV4dEVkaXRvclNlbGVjdG9yOiAoKSA9PiAnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJyxcbiAgICBpbmNsdXNpb25Qcmlvcml0eTogMCxcbiAgICBnZXRTdWdnZXN0aW9uczogYXN5bmMgKHsgZWRpdG9yLCBwcmVmaXggfTogeyBlZGl0b3I6IFRleHRFZGl0b3IsIHByZWZpeDogc3RyaW5nIH0pID0+IHtcbiAgICAgIGNvbnN0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgICAgIGlmICghdmlldykge1xuICAgICAgICByZXR1cm4gW11cbiAgICAgIH1cbiAgICAgIHJldHVybiB2aWV3LmdldENvbXBsZXRpb25zKHByZWZpeClcbiAgICB9LFxuICB9XG59XG4iXX0=