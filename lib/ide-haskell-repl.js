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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBa0U7QUFDbEUsbUVBQTREO0FBQzVELCtEQUF3RDtBQUN4RCx5RUFHc0M7QUFFdEMsOEJBQXdCO0FBRXhCLElBQUksV0FBZ0MsQ0FBQTtBQUNwQyxNQUFNLFNBQVMsR0FBc0QsSUFBSSxPQUFPLEVBQUUsQ0FBQTtBQUNsRixNQUFNLFdBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUM1RCxJQUFJLGlCQUFtRCxDQUFBO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFtQixDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsaUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUYsSUFBSSxHQUFpQyxDQUFBO0FBRXJDO0lBQ0UsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtJQUV2QyxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsU0FBaUIsRUFBRSxFQUFFO1FBQzdDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN6RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUMsU0FBUyxDQUFBO1FBQ2xCLENBQUM7UUFDRCxNQUFNLENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7SUFDdEMsQ0FBQyxDQUFDLENBQ0gsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFH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ZW50RGVzYywgVGV4dEVkaXRvciB9IGZyb20gJ2F0b20nXG5pbXBvcnQgeyBJZGVIYXNrZWxsUmVwbEJhc2UgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcbmltcG9ydCB7IElkZUhhc2tlbGxSZXBsQmcgfSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmcnXG5pbXBvcnQge1xuICBJZGVIYXNrZWxsUmVwbFZpZXcsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vdmlld3MvaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5leHBvcnQgKiBmcm9tICcuL2NvbmZpZydcblxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5jb25zdCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5jb25zdCBiZ0VkaXRvck1hcDogTWFwPHN0cmluZywgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaT86IFVQSS5JVVBJSW5zdGFuY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSS5JVVBJSW5zdGFuY2UgfCB1bmRlZmluZWRcblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlKCkge1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS53b3Jrc3BhY2UuYWRkT3BlbmVyKCh1cmlUb09wZW46IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgbSA9IHVyaVRvT3Blbi5tYXRjaCgvXmlkZS1oYXNrZWxsOlxcL1xcL3JlcGxcXC8oLiopJC8pXG4gICAgICBpZiAoIShtICYmIG1bMV0pKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICAgIH1cbiAgICAgIHJldHVybiBjcmVhdGVSZXBsVmlldyh7IHVyaTogbVsxXSB9KVxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJzogYXN5bmMgKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoeyBjdXJyZW50VGFyZ2V0IH06IElFdmVudERlc2MpID0+IHtcbiAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpXG4gICAgaWYgKHZpZXcpIHsgdmlld1tmdW5jXSgpIH1cbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6ZXhlYy1jb21tYW5kJzogY29tbWFuZEZ1bmN0aW9uKCdleGVjQ29tbWFuZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1iYWNrJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5QmFjaycpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1mb3J3YXJkJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5Rm9yd2FyZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0JzogY29tbWFuZEZ1bmN0aW9uKCdpbnRlcnJ1cHQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNsZWFyLW91dHB1dCc6IGNvbW1hbmRGdW5jdGlvbignY2xlYXInKSxcbiAgICB9KSxcbiAgKVxuXG4gIGNvbnN0IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uID0gKGZ1bmM6IHN0cmluZykgPT4gKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgb3BlbihjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCksIGZhbHNlKVxuICAgICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHsgY3VycmVudFRhcmdldCB9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCwgZmFsc2UpLnRoZW4oYXN5bmMgKG1vZGVsKSA9PiBtb2RlbC5ydW5Db21tYW5kKGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChhdG9tLm1lbnUuYWRkKFt7XG4gICAgbGFiZWw6ICdIYXNrZWxsIElERScsXG4gICAgc3VibWVudTogW3tcbiAgICAgIGxhYmVsOiAnT3BlbiBSRVBMJyxcbiAgICAgIGNvbW1hbmQ6ICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZScsXG4gICAgfV0sXG4gIH1dKSlcblxuICBzZXRUaW1lb3V0KFxuICAgICgpID0+IHtcbiAgICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKCkgfVxuICAgIH0sXG4gICAgNTAwMCxcbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwbFZpZXcoc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgY29uc3QgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcoeyB1cGlQcm9taXNlLCBzdGF0ZSB9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuKGVkaXRvcjogVGV4dEVkaXRvciwgYWN0aXZhdGUgPSB0cnVlKTogUHJvbWlzZTxJZGVIYXNrZWxsUmVwbFZpZXc+IHtcbiAgY29uc3QgZ3JhbW1hciA9IGVkaXRvciAmJiBlZGl0b3IuZ2V0R3JhbW1hcigpXG4gIGNvbnN0IHNjb3BlID0gZ3JhbW1hciAmJiBncmFtbWFyLnNjb3BlTmFtZVxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFBhdGgoKVxuICB9IGVsc2Uge1xuICAgIHVyaSA9ICcnXG4gIH1cbiAgcmV0dXJuIGF0b20ud29ya3NwYWNlLm9wZW4oYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3VyaX1gLCB7XG4gICAgc3BsaXQ6ICdyaWdodCcsXG4gICAgc2VhcmNoQWxsUGFuZXM6IHRydWUsXG4gICAgYWN0aXZhdGVQYW5lOiBhY3RpdmF0ZSxcbiAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlYWN0aXZhdGUoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSShyZWdpc3RlcjogVVBJLklVUElSZWdpc3RyYXRpb24pIHtcbiAgVVBJID0gcmVnaXN0ZXIoe1xuICAgIG5hbWU6ICdpZGUtaGFza2VsbC1yZXBsJyxcbiAgICBtZXNzYWdlVHlwZXM6IHtcbiAgICAgIHJlcGw6IHtcbiAgICAgICAgdXJpRmlsdGVyOiBmYWxzZSxcbiAgICAgICAgYXV0b1Njcm9sbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB0b29sdGlwOiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIG9uRGlkU2F2ZUJ1ZmZlcjogZGlkU2F2ZUJ1ZmZlcixcbiAgICB9LFxuICB9KVxuICByZXNvbHZlVVBJUHJvbWlzZShVUEkpXG4gIGRpc3Bvc2FibGVzLmFkZChVUEkpXG4gIHJldHVybiBVUElcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvdWxkU2hvd1Rvb2x0aXAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuICBjb25zdCB7IGN3ZCwgY2FiYWwsIGNvbXAgfSA9IGF3YWl0IElkZUhhc2tlbGxSZXBsQmFzZS5jb21wb25lbnRGcm9tVVJJKGVkaXRvci5nZXRQYXRoKCkpXG4gIGNvbnN0IGhhc2ggPSBgJHtjd2QuZ2V0UGF0aCgpfTo6JHtjYWJhbC5uYW1lfTo6JHtjb21wWzBdfWBcbiAgbGV0IGJnID0gYmdFZGl0b3JNYXAuZ2V0KGhhc2gpXG4gIGlmICghYmcpIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwgeyB1cmk6IGVkaXRvci5nZXRQYXRoKCkgfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoaGFzaCwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5hc3luYyBmdW5jdGlvbiBkaWRTYXZlQnVmZmVyKGJ1ZmZlcjogQXRvbVR5cGVzLlRleHRCdWZmZXIpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuY2hlY2tPblNhdmUnKSkge1xuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IHsgY3dkLCBjYWJhbCwgY29tcCB9ID0gYXdhaXQgSWRlSGFza2VsbFJlcGxCYXNlLmNvbXBvbmVudEZyb21VUkkoYnVmZmVyLmdldFBhdGgoKSlcbiAgY29uc3QgaGFzaCA9IGAke2N3ZC5nZXRQYXRoKCl9Ojoke2NhYmFsLm5hbWV9Ojoke2NvbXBbMF19YFxuICBjb25zdCBiZ3QgPSBiZ0VkaXRvck1hcC5nZXQoaGFzaClcbiAgaWYgKGJndCkge1xuICAgIGJndC5naGNpUmVsb2FkKClcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWJ1ZmZlci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgY29uc3QgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7IHVyaTogYnVmZmVyLmdldFBhdGgoKSB9KVxuICAgIGJnRWRpdG9yTWFwLnNldChoYXNoLCBiZylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAoKSB7XG4gIHJldHVybiB7XG4gICAgc2NvcGVTZWxlY3RvcjogJy5zb3VyY2UuaGFza2VsbCcsXG4gICAgZGlzYWJsZUZvclNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwgLmNvbW1lbnQnLFxuICAgIGdldFRleHRFZGl0b3JTZWxlY3RvcjogKCkgPT4gJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgaW5jbHVzaW9uUHJpb3JpdHk6IDAsXG4gICAgZ2V0U3VnZ2VzdGlvbnM6IGFzeW5jICh7IGVkaXRvciwgcHJlZml4IH06IHsgZWRpdG9yOiBUZXh0RWRpdG9yLCBwcmVmaXg6IHN0cmluZyB9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19