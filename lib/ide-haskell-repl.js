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
        return;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0Q7QUFDcEQsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFFeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLE1BQU0sU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLE1BQU0sV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2xGLElBQUksaUJBQW1ELENBQUE7QUFDdkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQW1CLENBQUMsT0FBTyxPQUFPLGlCQUFpQixHQUFHLE9BQU8sQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlGLElBQUksR0FBaUMsQ0FBQTtBQVdyQyxrQkFBMEIsS0FBYTtJQUNyQyxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO0lBRXZDLFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFpQjtRQUN6QyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUE7UUFDekQsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakIsTUFBTSxDQUFBO1FBQ1IsQ0FBQztRQUNELE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQTtJQUNwQyxDQUFDLENBQUMsQ0FDSCxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRTtRQUNwQyx5QkFBeUIsRUFBRSxDQUFPLEVBQUMsYUFBYSxFQUFhLG9EQUFLLE1BQU0sQ0FBTixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUEsR0FBQTtLQUNqRyxDQUFDLENBQ0gsQ0FBQTtJQUVELE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBWSxLQUFLLENBQUMsRUFBQyxhQUFhLEVBQWE7UUFDcEUsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTtRQUNwRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUE7UUFBQyxDQUFDO0lBQzVCLENBQUMsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsbUNBQW1DLEVBQUU7UUFDckQsK0JBQStCLEVBQUUsZUFBZSxDQUFDLGFBQWEsQ0FBQztRQUMvRCwrQkFBK0IsRUFBRSxlQUFlLENBQUMsYUFBYSxDQUFDO1FBQy9ELGtDQUFrQyxFQUFFLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNyRSw4QkFBOEIsRUFBRSxlQUFlLENBQUMsWUFBWSxDQUFDO1FBQzdELGdDQUFnQyxFQUFFLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQztRQUNyRSw0Q0FBNEMsRUFBRSxlQUFlLENBQUMsd0JBQXdCLENBQUM7UUFDdkYsaUNBQWlDLEVBQUUsZUFBZSxDQUFDLFdBQVcsQ0FBQztRQUMvRCwrQkFBK0IsRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDO0tBQzFELENBQUMsQ0FDSCxDQUFBO0lBRUQsTUFBTSx1QkFBdUIsR0FBRyxDQUFDLElBQVksS0FBSyxDQUFDLEVBQUMsYUFBYSxFQUFhO1FBQzVFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDO2FBQ3BDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0lBQ2pDLENBQUMsQ0FBQTtJQUVELFdBQVcsQ0FBQyxHQUFHLENBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMseUNBQXlDLEVBQUU7UUFDM0QsK0NBQStDLEVBQUUsQ0FBQyxFQUFDLGFBQWEsRUFBYTtZQUMzRSxNQUFNLEVBQUUsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUE7WUFDbkMsTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixFQUFFLENBQUMsT0FBTyxFQUFFLENBQUE7WUFDM0MsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7UUFDL0MsQ0FBQztRQUNELHdDQUF3QyxFQUFFLENBQUMsRUFBQyxhQUFhLEVBQWE7WUFDcEUsTUFBTSxFQUFFLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxDQUFBO1lBQ25DLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFBO1lBQzNDLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQU8sS0FBSyxvREFBSyxNQUFNLENBQU4sS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQTtRQUM5RCxDQUFDO1FBQ0QsOEJBQThCLEVBQUUsdUJBQXVCLENBQUMsWUFBWSxDQUFDO1FBQ3JFLGdDQUFnQyxFQUFFLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDO1FBQzdFLDRDQUE0QyxFQUFFLHVCQUF1QixDQUFDLHdCQUF3QixDQUFDO0tBQ2hHLENBQUMsQ0FDSCxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzdCLEtBQUssRUFBRSxhQUFhO1lBQ3BCLE9BQU8sRUFBRSxDQUFDO29CQUNSLEtBQUssRUFBRSxXQUFXO29CQUNsQixPQUFPLEVBQUUseUJBQXlCO2lCQUNuQyxDQUFDO1NBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUVKLFVBQVUsQ0FBQztRQUNULEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUFDLGlCQUFpQixFQUFFLENBQUE7UUFBQyxDQUFDO0lBQ3hELENBQUMsRUFBVSxJQUFJLENBQUMsQ0FBQTtBQUNsQixDQUFDO0FBdkVELDRCQXVFQztBQUVELHdCQUFnQyxFQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFhO0lBQ25GLE1BQU0sSUFBSSxHQUFHLElBQUksMENBQWtCLENBQUMsVUFBVSxFQUFFLEVBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUMsQ0FBQyxDQUFBO0lBQzFGLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFBO0FBQ2IsQ0FBQztBQUpELHdDQUlDO0FBRUQsY0FBcUIsTUFBa0IsRUFBRSxRQUFRLEdBQUcsSUFBSTs7UUFDdEQsTUFBTSxPQUFPLEdBQUcsTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUE7UUFDbkQsTUFBTSxLQUFLLEdBQUcsT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFBO1FBQ2hELElBQUksR0FBRyxDQUFBO1FBQ1AsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLEdBQUcsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUE7UUFDeEIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sR0FBRyxHQUFHLEVBQUUsQ0FBQTtRQUNWLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsRUFBRSxFQUFFO1lBQ3RELEtBQUssRUFBRSxPQUFPO1lBQ2QsY0FBYyxFQUFFLElBQUk7WUFDcEIsWUFBWSxFQUFFLFFBQVE7U0FDdkIsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUFBO0FBRUQ7SUFDRSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUE7QUFDdkIsQ0FBQztBQUZELGdDQUVDO0FBRUQsb0JBQTRCLFFBQThCO0lBQ3hELEdBQUcsR0FBRyxRQUFRLENBQUM7UUFDYixJQUFJLEVBQUUsa0JBQWtCO1FBQ3hCLFlBQVksRUFBRTtZQUNaLElBQUksRUFBRTtnQkFDSixTQUFTLEVBQUUsS0FBSztnQkFDaEIsVUFBVSxFQUFFLElBQUk7YUFDakI7U0FDRjtRQUNELE9BQU8sRUFBRTtZQUNQLFFBQVEsRUFBRSxHQUFHO1lBQ2IsT0FBTyxFQUFFLGlCQUFpQjtTQUMzQjtRQUNELE1BQU0sRUFBRTtZQUNOLGVBQWUsRUFBRSxhQUFhO1NBQy9CO0tBQ0YsQ0FBQyxDQUFBO0lBQ0YsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDdEIsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUNwQixNQUFNLENBQUMsR0FBRyxDQUFBO0FBQ1osQ0FBQztBQXBCRCxnQ0FvQkM7QUFFRCwyQkFBa0MsTUFBNEIsRUFBRSxNQUF1QixFQUFFLElBQVk7O1FBQ25HLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkQsTUFBTSxDQUFBO1FBQ1IsQ0FBQztRQUlELElBQUksRUFBb0IsQ0FBQTtRQUN4QixNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFBO1FBQy9DLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDUixFQUFFLEdBQUcsR0FBRyxDQUFBO1FBQ1YsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLENBQUE7WUFDUixDQUFDO1lBQ0QsTUFBTSxVQUFVLENBQUE7WUFDaEIsRUFBRSxHQUFHLElBQUksc0NBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBQyxDQUFDLENBQUE7WUFDOUQsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDekMsQ0FBQztRQUNELE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUNoRCxDQUFDO0NBQUE7QUFFRCx1QkFBOEIsTUFBNEI7O1FBQ3hELE1BQU0sQ0FBQTtRQUNOLE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDbkMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNSLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQTtRQUNsQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQTtZQUNSLENBQUM7WUFDRCxNQUFNLFVBQVUsQ0FBQTtZQUNoQixNQUFNLEVBQUUsR0FBRyxJQUFJLHNDQUFnQixDQUFDLFVBQVUsRUFBRSxFQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUMsQ0FBQyxDQUFBO1lBQ3BFLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBQzdCLENBQUM7SUFDSCxDQUFDO0NBQUE7QUFFRDtJQUNFLE1BQU0sQ0FBQztRQUNMLGFBQWEsRUFBRSxpQkFBaUI7UUFDaEMsdUJBQXVCLEVBQUUsMEJBQTBCO1FBQ25ELHFCQUFxQixFQUFFLE1BQU0sbUNBQW1DO1FBQ2hFLGlCQUFpQixFQUFFLENBQUM7UUFDcEIsY0FBYyxFQUFFLENBQU8sRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUF1QztZQUMzRSxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1lBQ2xDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDVixNQUFNLENBQUMsRUFBRSxDQUFBO1lBQ1gsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ3BDLENBQUMsQ0FBQTtLQUNGLENBQUE7QUFDSCxDQUFDO0FBZEQsZ0VBY0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0NvbXBvc2l0ZURpc3Bvc2FibGUsIFRleHRFZGl0b3J9IGZyb20gJ2F0b20nXG5pbXBvcnQge0lkZUhhc2tlbGxSZXBsQmd9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iZydcbmltcG9ydCB7XG4gIElkZUhhc2tlbGxSZXBsVmlldyxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi92aWV3cy9pZGUtaGFza2VsbC1yZXBsLXZpZXcnXG5cbmV4cG9ydCAqIGZyb20gJy4vY29uZmlnJ1xuXG5sZXQgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbmNvbnN0IGVkaXRvck1hcDogV2Vha01hcDxBdG9tVHlwZXMuVGV4dEVkaXRvciwgSWRlSGFza2VsbFJlcGxWaWV3PiA9IG5ldyBXZWFrTWFwKClcbmNvbnN0IGJnRWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0QnVmZmVyLCBJZGVIYXNrZWxsUmVwbEJnPiA9IG5ldyBXZWFrTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaT86IFVQSS5JVVBJSW5zdGFuY2UpID0+IHZvaWRcbmNvbnN0IHVwaVByb21pc2UgPSBuZXcgUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPigocmVzb2x2ZSkgPT4geyByZXNvbHZlVVBJUHJvbWlzZSA9IHJlc29sdmUgfSlcbmxldCBVUEk6IFVQSS5JVVBJSW5zdGFuY2UgfCB1bmRlZmluZWRcblxuZGVjbGFyZSBpbnRlcmZhY2UgSUV2ZW50RGVzYyB7XG4gIGN1cnJlbnRUYXJnZXQ6IEhUTUxFbGVtZW50ICYgeyBnZXRNb2RlbCAoKTogQXRvbVR5cGVzLlRleHRFZGl0b3IgfVxuICBhYm9ydEtleUJpbmRpbmc/ICgpOiB2b2lkXG59XG5cbmRlY2xhcmUgaW50ZXJmYWNlIElTdGF0ZSB7XG4gIC8vIFRPRE9cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlIChzdGF0ZTogSVN0YXRlKSB7XG4gIGRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gIGRpc3Bvc2FibGVzLmFkZChcbiAgICBhdG9tLndvcmtzcGFjZS5hZGRPcGVuZXIoKHVyaVRvT3Blbjogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBtID0gdXJpVG9PcGVuLm1hdGNoKC9eaWRlLWhhc2tlbGw6XFwvXFwvcmVwbFxcLyguKikkLylcbiAgICAgIGlmICghKG0gJiYgbVsxXSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlUmVwbFZpZXcoe3VyaTogbVsxXX0pXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnOiBhc3luYyAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBjb21tYW5kRnVuY3Rpb24gPSAoZnVuYzogc3RyaW5nKSA9PiAoe2N1cnJlbnRUYXJnZXR9OiBJRXZlbnREZXNjKSA9PiB7XG4gICAgY29uc3QgdmlldyA9IGVkaXRvck1hcC5nZXQoY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKVxuICAgIGlmICh2aWV3KSB7IHZpZXdbZnVuY10oKSB9XG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmV4ZWMtY29tbWFuZCc6IGNvbW1hbmRGdW5jdGlvbignZXhlY0NvbW1hbmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktYmFjayc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUJhY2snKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktZm9yd2FyZCc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUZvcndhcmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdCc6IGNvbW1hbmRGdW5jdGlvbignaW50ZXJydXB0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXQnOiBjb21tYW5kRnVuY3Rpb24oJ2NsZWFyJyksXG4gICAgfSksXG4gIClcblxuICBjb25zdCBleHRlcm5hbENvbW1hbmRGdW5jdGlvbiA9IChmdW5jOiBzdHJpbmcpID0+ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSwgZmFsc2UpXG4gICAgLnRoZW4oKG1vZGVsKSA9PiBtb2RlbFtmdW5jXSgpKVxuICB9XG5cbiAgZGlzcG9zYWJsZXMuYWRkKFxuICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yOm5vdCguaWRlLWhhc2tlbGwtcmVwbCknLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjb3B5LXNlbGVjdGlvbi10by1yZXBsLWlucHV0JzogKHtjdXJyZW50VGFyZ2V0fTogSUV2ZW50RGVzYykgPT4ge1xuICAgICAgICBjb25zdCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBjb25zdCBjbWQgPSBlZC5nZXRMYXN0U2VsZWN0aW9uKCkuZ2V0VGV4dCgpXG4gICAgICAgIG9wZW4oZWQpLnRoZW4oKG1vZGVsKSA9PiBtb2RlbC5jb3B5VGV4dChjbWQpKVxuICAgICAgfSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnJ1bi1zZWxlY3Rpb24taW4tcmVwbCc6ICh7Y3VycmVudFRhcmdldH06IElFdmVudERlc2MpID0+IHtcbiAgICAgICAgY29uc3QgZWQgPSBjdXJyZW50VGFyZ2V0LmdldE1vZGVsKClcbiAgICAgICAgY29uc3QgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkLCBmYWxzZSkudGhlbihhc3luYyAobW9kZWwpID0+IG1vZGVsLnJ1bkNvbW1hbmQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKGF0b20ubWVudS5hZGQoW3tcbiAgICBsYWJlbDogJ0hhc2tlbGwgSURFJyxcbiAgICBzdWJtZW51OiBbe1xuICAgICAgbGFiZWw6ICdPcGVuIFJFUEwnLFxuICAgICAgY29tbWFuZDogJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJyxcbiAgICB9XSxcbiAgfV0pKVxuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKCkgfVxuICB9LCAgICAgICAgIDUwMDApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXBsVmlldyAoe3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH06IElWaWV3U3RhdGUpIHtcbiAgY29uc3QgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcodXBpUHJvbWlzZSwge3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH0pXG4gIGVkaXRvck1hcC5zZXQodmlldy5lZGl0b3IsIHZpZXcpXG4gIHJldHVybiB2aWV3XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW4gKGVkaXRvcjogVGV4dEVkaXRvciwgYWN0aXZhdGUgPSB0cnVlKTogUHJvbWlzZTxJZGVIYXNrZWxsUmVwbFZpZXc+IHtcbiAgY29uc3QgZ3JhbW1hciA9IGVkaXRvciA/IGVkaXRvci5nZXRHcmFtbWFyKCkgOiBudWxsXG4gIGNvbnN0IHNjb3BlID0gZ3JhbW1hciA/IGdyYW1tYXIuc2NvcGVOYW1lIDogbnVsbFxuICBsZXQgdXJpXG4gIGlmIChzY29wZSAmJiBzY29wZS5lbmRzV2l0aCgnaGFza2VsbCcpKSB7XG4gICAgdXJpID0gZWRpdG9yLmdldFBhdGgoKVxuICB9IGVsc2Uge1xuICAgIHVyaSA9ICcnXG4gIH1cbiAgcmV0dXJuIGF0b20ud29ya3NwYWNlLm9wZW4oYGlkZS1oYXNrZWxsOi8vcmVwbC8ke3VyaX1gLCB7XG4gICAgc3BsaXQ6ICdyaWdodCcsXG4gICAgc2VhcmNoQWxsUGFuZXM6IHRydWUsXG4gICAgYWN0aXZhdGVQYW5lOiBhY3RpdmF0ZSxcbiAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlYWN0aXZhdGUgKCkge1xuICBkaXNwb3NhYmxlcy5kaXNwb3NlKClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVVUEkgKHJlZ2lzdGVyOiBVUEkuSVVQSVJlZ2lzdHJhdGlvbikge1xuICBVUEkgPSByZWdpc3Rlcih7XG4gICAgbmFtZTogJ2lkZS1oYXNrZWxsLXJlcGwnLFxuICAgIG1lc3NhZ2VUeXBlczoge1xuICAgICAgcmVwbDoge1xuICAgICAgICB1cmlGaWx0ZXI6IGZhbHNlLFxuICAgICAgICBhdXRvU2Nyb2xsOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRvb2x0aXA6IHtcbiAgICAgIHByaW9yaXR5OiAyMDAsXG4gICAgICBoYW5kbGVyOiBzaG91bGRTaG93VG9vbHRpcCxcbiAgICB9LFxuICAgIGV2ZW50czoge1xuICAgICAgb25EaWRTYXZlQnVmZmVyOiBkaWRTYXZlQnVmZmVyXG4gICAgfSxcbiAgfSlcbiAgcmVzb2x2ZVVQSVByb21pc2UoVVBJKVxuICBkaXNwb3NhYmxlcy5hZGQoVVBJKVxuICByZXR1cm4gVVBJXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNob3VsZFNob3dUb29sdGlwIChlZGl0b3I6IEF0b21UeXBlcy5UZXh0RWRpdG9yLCBjcmFuZ2U6IEF0b21UeXBlcy5SYW5nZSwgdHlwZTogc3RyaW5nKSB7XG4gIGlmICghYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnNob3dUeXBlcycpKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8gVE9ETzogbW9yZSBlZmZlY3RpdmUgYmdFZGl0b3JNYXBcbiAgLy8gc2hvdWxkIGhhdmUgb25lIGdoY2kgaW5zdGFuY2UgcGVyIHByb2plY3QgY29tcG9uZW50XG4gIC8vIG5vdCBwZXIgZmlsZS5cbiAgbGV0IGJnOiBJZGVIYXNrZWxsUmVwbEJnXG4gIGNvbnN0IGJndCA9IGJnRWRpdG9yTWFwLmdldChlZGl0b3IuZ2V0QnVmZmVyKCkpXG4gIGlmIChiZ3QpIHtcbiAgICBiZyA9IGJndFxuICB9IGVsc2Uge1xuICAgIGlmICghZWRpdG9yLmdldFBhdGgoKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGF3YWl0IHVwaVByb21pc2VcbiAgICBiZyA9IG5ldyBJZGVIYXNrZWxsUmVwbEJnKHVwaVByb21pc2UsIHt1cmk6IGVkaXRvci5nZXRQYXRoKCl9KVxuICAgIGJnRWRpdG9yTWFwLnNldChlZGl0b3IuZ2V0QnVmZmVyKCksIGJnKVxuICB9XG4gIHJldHVybiBiZy5zaG93VHlwZUF0KGVkaXRvci5nZXRQYXRoKCksIGNyYW5nZSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGlkU2F2ZUJ1ZmZlciAoYnVmZmVyOiBBdG9tVHlwZXMuVGV4dEJ1ZmZlcikge1xuICByZXR1cm5cbiAgY29uc3QgYmd0ID0gYmdFZGl0b3JNYXAuZ2V0KGJ1ZmZlcilcbiAgaWYgKGJndCkge1xuICAgIGJndC5naGNpUmVsb2FkKClcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWJ1ZmZlci5nZXRQYXRoKCkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCB1cGlQcm9taXNlXG4gICAgY29uc3QgYmcgPSBuZXcgSWRlSGFza2VsbFJlcGxCZyh1cGlQcm9taXNlLCB7dXJpOiBidWZmZXIuZ2V0UGF0aCgpfSlcbiAgICBiZ0VkaXRvck1hcC5zZXQoYnVmZmVyLCBiZylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiBhc3luYyAoe2VkaXRvciwgcHJlZml4fToge2VkaXRvcjogVGV4dEVkaXRvciwgcHJlZml4OiBzdHJpbmd9KSA9PiB7XG4gICAgICBjb25zdCB2aWV3ID0gZWRpdG9yTWFwLmdldChlZGl0b3IpXG4gICAgICBpZiAoIXZpZXcpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgICByZXR1cm4gdmlldy5nZXRDb21wbGV0aW9ucyhwcmVmaXgpXG4gICAgfSxcbiAgfVxufVxuIl19