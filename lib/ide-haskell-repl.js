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
function consumeUPI(service) {
    UPI = service.register({
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
        let bg;
        const bgt = bgEditorMap.get(editor.getBuffer());
        if (bgt) {
            bg = bgt;
        }
        else {
            if (!editor.getPath()) {
                return;
            }
            yield upiPromise;
            bg = new ide_haskell_repl_bg_1.IdeHaskellReplBg(upiPromise, { uri: editor.getPath() });
            bgEditorMap.set(editor.getBuffer(), bg);
        }
        return bg.showTypeAt(editor.getPath(), crange);
    });
}
function didSaveBuffer(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        const bgt = bgEditorMap.get(buffer);
        if (bgt) {
            bgt.ghciReload();
        }
        else {
            if (!buffer.getPath()) {
                return;
            }
            yield upiPromise;
            const bg = new ide_haskell_repl_bg_1.IdeHaskellReplBg(upiPromise, { uri: buffer.getPath() });
            bgEditorMap.set(buffer, bg);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0Q7QUFDcEQsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFFeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLE1BQU0sU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLE1BQU0sV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLElBQUksaUJBQW1ELENBQUE7QUFDdkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQW1CLENBQUMsT0FBTyxPQUFPLGlCQUFpQixHQUFHLE9BQU8sQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlGLElBQUksR0FBaUMsQ0FBQTtBQVdyQyxrQkFBMEIsS0FBYTtJQUNyQyxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO0lBRXZDLFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUE7UUFDekQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsTUFBTSxDQUFBO1FBQ1IsQ0FBQztRQUNELE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQTtJQUNwQyxDQUFDLENBQUMsQ0FDSCxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRTtRQUNwQyx5QkFBeUIs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QkFBMEI7UUFDbkQscUJBQXFCLEVBQUUsTUFBTSxtQ0FBbUM7UUFDaEUsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixjQUFjLEVBQUUsQ0FBTyxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQXVDO1lBQzNFLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDbEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNWLE1BQU0sQ0FBQyxFQUFFLENBQUE7WUFDWCxDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDcEMsQ0FBQyxDQUFBO0tBQ0YsQ0FBQTtBQUNILENBQUM7QUFkRCxnRUFjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Q29tcG9zaXRlRGlzcG9zYWJsZSwgVGV4dEVkaXRvcn0gZnJvbSAnYXRvbSdcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxCZ30gZnJvbSAnLi9pZGUtaGFza2VsbC1yZXBsLWJnJ1xuaW1wb3J0IHtcbiAgSWRlSGFza2VsbFJlcGxWaWV3LFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuL3ZpZXdzL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuZXhwb3J0ICogZnJvbSAnLi9jb25maWcnXG5cbmxldCBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuY29uc3QgZWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbFZpZXc+ID0gbmV3IFdlYWtNYXAoKVxuY29uc3QgYmdFZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRCdWZmZXIsIElkZUhhc2tlbGxSZXBsQmc+ID0gbmV3IFdlYWtNYXAoKVxubGV0IHJlc29sdmVVUElQcm9taXNlOiAodXBpPzogVVBJLklVUElJbnN0YW5jZSkgPT4gdm9pZFxuY29uc3QgdXBpUHJvbWlzZSA9IG5ldyBQcm9taXNlPFVQSS5JVVBJSW5zdGFuY2U+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVVUElQcm9taXNlID0gcmVzb2x2ZSB9KVxubGV0IFVQSTogVVBJLklVUElJbnN0YW5jZSB8IHVuZGVmaW5lZFxuXG5kZWNsYXJlIGludGVyZmFjZSBJRXZlbnREZXNjIHtcbiAgY3VycmVudFRhcmdldDogSFRNTEVsZW1lbnQgJiB7IGdldE1vZGVsICgpOiBBdG9tVHlwZXMuVGV4dEVkaXRvciB9XG4gIGFib3J0S2V5QmluZGluZz8gKCk6IHZvaWRcbn1cblxuZGVjbGFyZSBpbnRlcmZhY2UgSVN0YXRlIHtcbiAgLy8gVE9ET1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWN0aXZhdGUgKHN0YXRlOiBJU3RhdGUpIHtcbiAgZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20ud29ya3NwYWNlLmFkZE9wZW5lcigodXJpVG9PcGVuOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IG0gPSB1cmlUb09wZW4ubWF0Y2goL15pZGUtaGFza2VsbDpcXC9cXC9yZXBsXFwvKC4qKSQvKVxuICAgICAgaWYgKCEobSAmJiBtWzFdKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHJldHVybiBjcmVhdGVSZXBsVmlldyh7dXJpOiBtWzFdfSlcbiAgICB9KSxcbiAgKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcicsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZSc6IGFzeW5jICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKSxcbiAgICB9KSxcbiAgKVxuXG4gIGNvbnN0IGNvbW1hbmRGdW5jdGlvbiA9IChmdW5jOiBzdHJpbmcpID0+ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChjdXJyZW50VGFyZ2V0LmdldE1vZGVsKCkpXG4gICAgaWYgKHZpZXcpIHsgdmlld1tmdW5jXSgpIH1cbiAgfVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvci5pZGUtaGFza2VsbC1yZXBsJywge1xuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6ZXhlYy1jb21tYW5kJzogY29tbWFuZEZ1bmN0aW9uKCdleGVjQ29tbWFuZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1iYWNrJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5QmFjaycpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6aGlzdG9yeS1mb3J3YXJkJzogY29tbWFuZEZ1bmN0aW9uKCdoaXN0b3J5Rm9yd2FyZCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6Z2hjaS1yZWxvYWQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBjb21tYW5kRnVuY3Rpb24oJ3RvZ2dsZUF1dG9SZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktaW50ZXJydXB0JzogY29tbWFuZEZ1bmN0aW9uKCdpbnRlcnJ1cHQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNsZWFyLW91dHB1dCc6IGNvbW1hbmRGdW5jdGlvbignY2xlYXInKSxcbiAgICB9KSxcbiAgKVxuXG4gIGNvbnN0IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uID0gKGZ1bmM6IHN0cmluZykgPT4gKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgIG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpLCBmYWxzZSlcbiAgICAudGhlbigobW9kZWwpID0+IG1vZGVsW2Z1bmNdKCkpXG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3I6bm90KC5pZGUtaGFza2VsbC1yZXBsKScsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNvcHktc2VsZWN0aW9uLXRvLXJlcGwtaW5wdXQnOiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgICAgIGNvbnN0IGVkID0gY3VycmVudFRhcmdldC5nZXRNb2RlbCgpXG4gICAgICAgIGNvbnN0IGNtZCA9IGVkLmdldExhc3RTZWxlY3Rpb24oKS5nZXRUZXh0KClcbiAgICAgICAgb3BlbihlZCkudGhlbigobW9kZWwpID0+IG1vZGVsLmNvcHlUZXh0KGNtZCkpXG4gICAgICB9LFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6cnVuLXNlbGVjdGlvbi1pbi1yZXBsJzogKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgICAgICBjb25zdCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBjb25zdCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQsIGZhbHNlKS50aGVuKGFzeW5jIChtb2RlbCkgPT4gbW9kZWwucnVuQ29tbWFuZChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbignZ2hjaVJlbG9hZFJlcGVhdCcpLFxuICAgICAgJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoYXRvbS5tZW51LmFkZChbe1xuICAgIGxhYmVsOiAnSGFza2VsbCBJREUnLFxuICAgIHN1Ym1lbnU6IFt7XG4gICAgICBsYWJlbDogJ09wZW4gUkVQTCcsXG4gICAgICBjb21tYW5kOiAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnLFxuICAgIH1dLFxuICB9XSkpXG5cbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKHJlc29sdmVVUElQcm9taXNlICYmICFVUEkpIHsgcmVzb2x2ZVVQSVByb21pc2UoKSB9XG4gIH0sICAgICAgICAgNTAwMClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlcGxWaWV3ICh7dXJpLCBjb250ZW50LCBoaXN0b3J5LCBhdXRvUmVsb2FkUmVwZWF0fTogSVZpZXdTdGF0ZSkge1xuICBjb25zdCB2aWV3ID0gbmV3IElkZUhhc2tlbGxSZXBsVmlldyh1cGlQcm9taXNlLCB7dXJpLCBjb250ZW50LCBoaXN0b3J5LCBhdXRvUmVsb2FkUmVwZWF0fSlcbiAgZWRpdG9yTWFwLnNldCh2aWV3LmVkaXRvciwgdmlldylcbiAgcmV0dXJuIHZpZXdcbn1cblxuYXN5bmMgZnVuY3Rpb24gb3BlbiAoZWRpdG9yOiBUZXh0RWRpdG9yLCBhY3RpdmF0ZSA9IHRydWUpOiBQcm9taXNlPElkZUhhc2tlbGxSZXBsVmlldz4ge1xuICBjb25zdCBncmFtbWFyID0gZWRpdG9yID8gZWRpdG9yLmdldEdyYW1tYXIoKSA6IG51bGxcbiAgY29uc3Qgc2NvcGUgPSBncmFtbWFyID8gZ3JhbW1hci5zY29wZU5hbWUgOiBudWxsXG4gIGxldCB1cmlcbiAgaWYgKHNjb3BlICYmIHNjb3BlLmVuZHNXaXRoKCdoYXNrZWxsJykpIHtcbiAgICB1cmkgPSBlZGl0b3IuZ2V0UGF0aCgpXG4gIH0gZWxzZSB7XG4gICAgdXJpID0gJydcbiAgfVxuICByZXR1cm4gYXRvbS53b3Jrc3BhY2Uub3BlbihgaWRlLWhhc2tlbGw6Ly9yZXBsLyR7dXJpfWAsIHtcbiAgICBzcGxpdDogJ3JpZ2h0JyxcbiAgICBzZWFyY2hBbGxQYW5lczogdHJ1ZSxcbiAgICBhY3RpdmF0ZVBhbmU6IGFjdGl2YXRlLFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSAoKSB7XG4gIGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVVQSSAoc2VydmljZTogVVBJLklVUElTZXJ2aWNlKSB7XG4gIFVQSSA9IHNlcnZpY2UucmVnaXN0ZXIoe1xuICAgIG5hbWU6ICdpZGUtaGFza2VsbC1yZXBsJyxcbiAgICBtZXNzYWdlVHlwZXM6IHtcbiAgICAgIHJlcGw6IHtcbiAgICAgICAgdXJpRmlsdGVyOiBmYWxzZSxcbiAgICAgICAgYXV0b1Njcm9sbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB0b29sdGlwOiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBldmVudHM6IHtcbiAgICAgIG9uRGlkU2F2ZUJ1ZmZlcjogZGlkU2F2ZUJ1ZmZlclxuICAgIH0sXG4gIH0pXG4gIHJlc29sdmVVUElQcm9taXNlKFVQSSlcbiAgZGlzcG9zYWJsZXMuYWRkKFVQSSlcbiAgcmV0dXJuIFVQSVxufVxuXG5hc3luYyBmdW5jdGlvbiBzaG91bGRTaG93VG9vbHRpcCAoZWRpdG9yOiBBdG9tVHlwZXMuVGV4dEVkaXRvciwgY3JhbmdlOiBBdG9tVHlwZXMuUmFuZ2UsIHR5cGU6IHN0cmluZykge1xuICBpZiAoIWF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnKSkge1xuICAgIHJldHVyblxuICB9XG4gIC8vIFRPRE86IG1vcmUgZWZmZWN0aXZlIGJnRWRpdG9yTWFwXG4gIC8vIHNob3VsZCBoYXZlIG9uZSBnaGNpIGluc3RhbmNlIHBlciBwcm9qZWN0IGNvbXBvbmVudFxuICAvLyBub3QgcGVyIGZpbGUuXG4gIGxldCBiZzogSWRlSGFza2VsbFJlcGxCZ1xuICBjb25zdCBiZ3QgPSBiZ0VkaXRvck1hcC5nZXQoZWRpdG9yLmdldEJ1ZmZlcigpKVxuICBpZiAoYmd0KSB7XG4gICAgYmcgPSBiZ3RcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWVkaXRvci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBlZGl0b3IuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoZWRpdG9yLmdldEJ1ZmZlcigpLCBiZylcbiAgfVxuICByZXR1cm4gYmcuc2hvd1R5cGVBdChlZGl0b3IuZ2V0UGF0aCgpLCBjcmFuZ2UpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRpZFNhdmVCdWZmZXIgKGJ1ZmZlcjogQXRvbVR5cGVzLlRleHRCdWZmZXIpIHtcbiAgY29uc3QgYmd0ID0gYmdFZGl0b3JNYXAuZ2V0KGJ1ZmZlcilcbiAgaWYgKGJndCkge1xuICAgIGJndC5naGNpUmVsb2FkKClcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWJ1ZmZlci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgY29uc3QgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBidWZmZXIuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoYnVmZmVyLCBiZylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiBhc3luYyAoe2VkaXRvciwgcHJlZml4fToge2VkaXRvcjogVGV4dEVkaXRvciwgcHJlZml4OiBzdHJpbmd9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19