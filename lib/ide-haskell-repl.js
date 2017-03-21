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
        const bgt = bgEditorMap.get(editor);
        if (bgt) {
            bg = bgt;
        }
        else {
            if (!editor.getPath()) {
                return;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0Q7QUFDcEQsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFHeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLE1BQU0sU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLE1BQU0sV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLElBQUksaUJBQThDLENBQUE7QUFDbEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLE9BQU8saUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDMUYsSUFBSSxHQUFpQixDQUFBO0FBV3JCLGtCQUEwQixLQUFhO0lBQ3JDLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7SUFFdkMsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQWlCO1FBQ3pDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN6RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUE7UUFDUixDQUFDO1FBQ0QsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFBO0lBQ3BDLENBQUMsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1FBQ3BDLHlCQUF5QixF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T0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUE7WUFDUixDQUFDO1lBQ0QsTUFBTSxVQUFVLENBQUE7WUFDaEIsRUFBRSxHQUFHLElBQUksc0NBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBQyxDQUFDLENBQUE7WUFDOUQsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDN0IsQ0FBQztRQUNELE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUNoRCxDQUFDO0NBQUE7QUFFRDtJQUNFLE1BQU0sQ0FBQztRQUNMLGFBQWEsRUFBRSxpQkFBaUI7UUFDaEMsdUJBQXVCLEVBQUUsMEJBQTBCO1FBQ25ELHFCQUFxQixFQUFFLE1BQU0sbUNBQW1DO1FBQ2hFLGlCQUFpQixFQUFFLENBQUM7UUFDcEIsY0FBYyxFQUFFLENBQU8sRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUF1QztZQUMzRSxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ2xDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDVixNQUFNLENBQUMsRUFBRSxDQUFBO1lBQ1gsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUMsQ0FBQTtLQUNGLENBQUE7QUFDSCxDQUFDO0FBZEQsZ0VBY0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0NvbXBvc2l0ZURpc3Bvc2FibGUsIFRleHRFZGl0b3J9IGZyb20gJ2F0b20nXG5pbXBvcnQge0lkZUhhc2tlbGxSZXBsQmd9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iZydcbmltcG9ydCB7XG4gIElkZUhhc2tlbGxSZXBsVmlldyxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi92aWV3cy9pZGUtaGFza2VsbC1yZXBsLXZpZXcnXG5cbmV4cG9ydCAqIGZyb20gJy4vY29uZmlnJ1xuXG50eXBlIFVQSUludGVyZmFjZSA9IGFueVxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5jb25zdCBlZGl0b3JNYXA6IFdlYWtNYXA8QXRvbVR5cGVzLlRleHRFZGl0b3IsIElkZUhhc2tlbGxSZXBsVmlldz4gPSBuZXcgV2Vha01hcCgpXG5jb25zdCBiZ0VkaXRvck1hcDogV2Vha01hcDxBdG9tVHlwZXMuVGV4dEVkaXRvciwgSWRlSGFza2VsbFJlcGxCZz4gPSBuZXcgV2Vha01hcCgpXG5sZXQgcmVzb2x2ZVVQSVByb21pc2U6ICh1cGk6IFVQSUludGVyZmFjZSkgPT4gdm9pZFxuY29uc3QgdXBpUHJvbWlzZSA9IG5ldyBQcm9taXNlPFVQSUludGVyZmFjZT4oKHJlc29sdmUpID0+IHsgcmVzb2x2ZVVQSVByb21pc2UgPSByZXNvbHZlIH0pXG5sZXQgVVBJOiBVUElJbnRlcmZhY2VcblxuZGVjbGFyZSBpbnRlcmZhY2UgSUV2ZW50RGVzYyB7XG4gIGN1cnJlbnRUYXJnZXQ6IEhUTUxFbGVtZW50ICYgeyBnZXRNb2RlbCAoKTogQXRvbVR5cGVzLlRleHRFZGl0b3IgfVxuICBhYm9ydEtleUJpbmRpbmc/ICgpOiB2b2lkXG59XG5cbmRlY2xhcmUgaW50ZXJmYWNlIElTdGF0ZSB7XG4gIC8vIFRPRE9cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlIChzdGF0ZTogSVN0YXRlKSB7XG4gIGRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLndvcmtzcGFjZS5hZGRPcGVuZXIoKHVyaVRvT3Blbjogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBtID0gdXJpVG9PcGVuLm1hdGNoKC9eaWRlLWhhc2tlbGw6XFwvXFwvcmVwbFxcLyguKikkLylcbiAgICAgIGlmICghKG0gJiYgbVsxXSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlUmVwbFZpZXcoe3VyaTogbVsxXX0pXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnOiBhc3luYyAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgY29uc3QgdmlldyA9IGVkaXRvck1hcC5nZXQoY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKVxuICAgIGlmICh2aWV3KSB7IHZpZXdbZnVuY10oKSB9XG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmV4ZWMtY29tbWFuZCc6IGNvbW1hbmRGdW5jdGlvbignZXhlY0NvbW1hbmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktYmFjayc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUJhY2snKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktZm9yd2FyZCc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUZvcndhcmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdCc6IGNvbW1hbmRGdW5jdGlvbignaW50ZXJydXB0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXQnOiBjb21tYW5kRnVuY3Rpb24oJ2NsZWFyJyksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBleHRlcm5hbENvbW1hbmRGdW5jdGlvbiA9IChmdW5jOiBzdHJpbmcpID0+ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSwgZmFsc2UpXG4gICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgICAgICBjb25zdCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBjb25zdCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQpLnRoZW4oKG1vZGVsKSA9PiBtb2RlbC5jb3B5VGV4dChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJ1bi1zZWxlY3Rpb24taW4tcmVwbCc6ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICAgICAgY29uc3QgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgY29uc3QgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkLCBmYWxzZSkudGhlbihhc3luYyAobW9kZWwpID0+IG1vZGVsLnJ1bkNvbW1hbmQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKGF0b20ubWVudS5hZGQoW3tcbiAgICBsYWJlbDogJ0hhc2tlbGwgSURFJyxcbiAgICBzdWJtZW51OiBbe1xuICAgICAgbGFiZWw6ICdPcGVuIFJFUEwnLFxuICAgICAgY29tbWFuZDogJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJyxcbiAgICB9XSxcbiAgfV0pKVxuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKG51bGwpIH1cbiAgfSwgICAgICAgICA1MDAwKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVwbFZpZXcgKHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9OiBJVmlld1N0YXRlKSB7XG4gIGNvbnN0IHZpZXcgPSBuZXcgSWRlSGFza2VsbFJlcGxWaWV3KHVwaVByb21pc2UsIHt1cmksIGNvbnRlbnQsIGhpc3RvcnksIGF1dG9SZWxvYWRSZXBlYXR9KVxuICBlZGl0b3JNYXAuc2V0KHZpZXcuZWRpdG9yLCB2aWV3KVxuICByZXR1cm4gdmlld1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuIChlZGl0b3I6IFRleHRFZGl0b3IsIGFjdGl2YXRlID0gdHJ1ZSk6IFByb21pc2U8SWRlSGFza2VsbFJlcGxWaWV3PiB7XG4gIGNvbnN0IGdyYW1tYXIgPSBlZGl0b3IgPyBlZGl0b3IuZ2V0R3JhbW1hcigpIDogbnVsbFxuICBjb25zdCBzY29wZSA9IGdyYW1tYXIgPyBncmFtbWFyLnNjb3BlTmFtZSA6IG51bGxcbiAgbGV0IHVyaVxuICBpZiAoc2NvcGUgJiYgc2NvcGUuZW5kc1dpdGgoJ2hhc2tlbGwnKSkge1xuICAgIHVyaSA9IGVkaXRvci5nZXRQYXRoKClcbiAgfSBlbHNlIHtcbiAgICB1cmkgPSAnJ1xuICB9XG4gIHJldHVybiBhdG9tLndvcmtzcGFjZS5vcGVuKGBpZGUtaGFza2VsbDovL3JlcGwvJHt1cml9YCwge1xuICAgIHNwbGl0OiAncmlnaHQnLFxuICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgIGFjdGl2YXRlUGFuZTogYWN0aXZhdGUsXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWFjdGl2YXRlICgpIHtcbiAgZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lVVBJIChzZXJ2aWNlOiBVUEkuSVVQSVNlcnZpY2UpIHtcbiAgVVBJID0gc2VydmljZS5yZWdpc3Rlcih7XG4gICAgbmFtZTogJ2lkZS1oYXNrZWxsLXJlcGwnLFxuICAgIG1lc3NhZ2VUeXBlczoge1xuICAgICAgcmVwbDoge1xuICAgICAgICB1cmlGaWx0ZXI6IGZhbHNlLFxuICAgICAgICBhdXRvU2Nyb2xsOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRvb2x0aXA6IHtcbiAgICAgIHByaW9yaXR5OiAyMDAsXG4gICAgICBoYW5kbGVyOiBzaG91bGRTaG93VG9vbHRpcCxcbiAgICB9LFxuICB9KVxuICByZXNvbHZlVVBJUHJvbWlzZShVUEkpXG4gIGRpc3Bvc2FibGVzLmFkZChVUEkpXG4gIHJldHVybiBVUElcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvdWxkU2hvd1Rvb2x0aXAgKGVkaXRvcjogQXRvbVR5cGVzLlRleHRFZGl0b3IsIGNyYW5nZTogQXRvbVR5cGVzLlJhbmdlLCB0eXBlOiBzdHJpbmcpIHtcbiAgaWYgKCFhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuc2hvd1R5cGVzJykpIHtcbiAgICByZXR1cm5cbiAgfVxuICAvLyBUT0RPOiBtb3JlIGVmZmVjdGl2ZSBiZ0VkaXRvck1hcFxuICAvLyBzaG91bGQgaGF2ZSBvbmUgZ2hjaSBpbnN0YW5jZSBwZXIgcHJvamVjdCBjb21wb25lbnRcbiAgLy8gbm90IHBlciBmaWxlLlxuICBsZXQgYmc6IElkZUhhc2tlbGxSZXBsQmdcbiAgY29uc3QgYmd0ID0gYmdFZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgaWYgKGJndCkge1xuICAgIGJnID0gYmd0XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFlZGl0b3IuZ2V0UGF0aCgpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwge3VyaTogZWRpdG9yLmdldFBhdGgoKX0pXG4gICAgYmdFZGl0b3JNYXAuc2V0KGVkaXRvciwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiBhc3luYyAoe2VkaXRvciwgcHJlZml4fToge2VkaXRvcjogVGV4dEVkaXRvciwgcHJlZml4OiBzdHJpbmd9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19