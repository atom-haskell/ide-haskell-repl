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
let editorMap = new WeakMap();
let bgEditorMap = new WeakMap();
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
        'ide-haskell-repl:clear-output': commandFunction('clear'),
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
        let bg;
        if (bgEditorMap.has(editor)) {
            bg = bgEditorMap.get(editor);
        }
        else {
            if (!editor.getPath()) {
                return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBd0M7QUFDeEMsK0RBQXNEO0FBQ3RELHlFQUdzQztBQUV0Qyw4QkFBd0I7QUFHeEIsSUFBSSxXQUFnQyxDQUFBO0FBQ3BDLElBQUksU0FBUyxHQUFzRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2hGLElBQUksV0FBVyxHQUFvRCxJQUFJLE9BQU8sRUFBRSxDQUFBO0FBQ2hGLElBQUksaUJBQThDLENBQUE7QUFDbEQsSUFBSSxVQUFVLEdBQUcsSUFBSSxPQUFPLENBQWUsQ0FBQyxPQUFPLE9BQU8saUJBQWlCLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEYsSUFBSSxHQUFpQixDQUFBO0FBRXJCLGtCQUEwQixLQUFLO0lBQzdCLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7SUFFdkMsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPO1FBQzFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQTtRQUN2RCxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQixNQUFNLENBQUE7UUFDUixDQUFDO1FBQ0QsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFBO0lBQ3BDLENBQUMsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUNiLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFO1FBQ3BDLHlCQUF5QixFQUFFLENBQU8sRUFBQyxhQUFhLEVBQUMsb0RBQUssTUFBTSxDQUFOLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQSxHQUFBO0tBQ3JGLENBQUMsQ0FDSCxDQUFBO0lBRUQsSUFBSSxlQUFlLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFDLGFBQWEsRUFBQztRQUM5QyxJQUFJLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1FBQ2xELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQTtRQUFDLENBQUM7SUFDNUIsQ0FBQyxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsRUFBRTtRQUNyRCwrQkFBK0IsRUFBRSxlQUFlLENBQUMsYUFBYSxDQUFDO1FBQy9ELCtCQUErQixFQUFFLGVBQWUsQ0FBQyxhQUFhLENBQUM7UUFDL0Qsa0NBQWtDLEVBQUUsZUFBZSxDQUFDLGdCQUFnQixDQUFDO1FBQ3JFLDhCQUE4QixFQUFFLGVBQWUsQ0FBQyxZQUFZLENBQUM7UUFDN0QsZ0NBQWdDLEVBQUUsZUFBZSxDQUFDLGtCQUFrQixDQUFDO1FBQ3JFLDRDQUE0QyxFQUFFLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztRQUN2RixpQ0FBaUMsRUFBRSxlQUFlLENBQUMsV0FBVyxDQUFDO1FBQy9ELCtCQUErQixFQUFFLGVBQWUsQ0FBQyxPQUFPLENBQUM7S0FDMUQsQ0FBQyxDQUNILENBQUE7SUFFRCxJQUFJLHVCQUF1QixHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBQyxhQUFhLEVBQUM7UUFDdEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUM7YUFDcEMsSUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUE7SUFDakMsQ0FBQyxDQUFBO0lBRUQsV0FBVyxDQUFDLEdBQUcsQ0FDYixJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyx5Q0FBeUMsRUFBRTtRQUMzRCwrQ0FBK0MsRUFBRSxDQUFDLEVBQUMsYUFBYSxFQUFDO1lBQy9ELElBQUksRUFBRSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtZQUNqQyxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUN6QyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUMvQyxDQUFDO1FBQ0Qsd0NBQXdDLEVBQUUsQ0FBQyxFQUFDLGFBQWEsRUFBQztZQUN4RCxJQUFJLEVBQUUsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUE7WUFDakMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixFQUFFLENBQUMsT0FBTyxFQUFFLENBQUE7WUFDekMsSUFBSSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBTyxLQUFLLG9EQUFLLE1BQU0sQ0FBTixLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBLEdBQUEsQ0FBQyxDQUFBO1FBQzlELENBQUM7UUFDRCw4QkFBOEIsRUFBRSx1QkFBdUIsQ0FBQyxZQUFZLENBQUM7UUFDckUsZ0NBQWdDLEVBQUUsdUJBQXVCLENBQUMsa0JBQWtCLENBQUM7UUFDN0UsNENBQTRDLEVBQUUsdUJBQXVCLENBQUMsd0JBQXdCLENBQUM7S0FDaEcsQ0FBQyxDQUNILENBQUE7SUFFRCxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDN0IsS0FBSyxFQUFFLGFBQWE7WUFDcEIsT0FBTyxFQUFFLENBQUM7b0JBQ1IsS0FBSyxFQUFFLFdBQVc7b0JBQ2xCLE9BQU8sRUFBRSx5QkFBeUI7aUJBQ25DLENBQUM7U0FDSCxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBRUosVUFBVSxDQUFDO1FBQ1QsRUFBRSxDQUFDLENBQUMsaUJBQWlCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUE7UUFBQyxDQUFDO0lBQzVELENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNWLENBQUM7QUF2RUQsNEJBdUVDO0FBRUQsd0JBQWdDLEVBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQWE7SUFDbkYsSUFBSSxJQUFJLEdBQUcsSUFBSSwwQ0FBa0IsQ0FBQyxVQUFVLEVBQUUsRUFBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBQyxDQUFDLENBQUE7SUFDeEYsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUE7QUFDYixDQUFDO0FBSkQsd0NBSUM7QUFFRCxjQUFxQixNQUFNLEVBQUUsUUFBUSxHQUFHLElBQUk7O1FBQzFDLElBQUksT0FBTyxHQUFHLE1BQU0sR0FBRyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFBO1FBQ2pELElBQUksS0FBSyxHQUFHLE9BQU8sR0FBRyxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQTtRQUM5QyxJQUFJLEdBQUcsQ0FBQTtRQUNQLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QyxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ3ZCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLEdBQUcsR0FBRyxFQUFFLENBQUE7UUFDVixDQUFDO1FBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHNCQUFzQixHQUFHLEVBQUUsRUFBRTtZQUN0RCxLQUFLLEVBQUUsT0FBTztZQUNkLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLFlBQVksRUFBRSxRQUFRO1NBQ3ZCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FBQTtBQUVEO0lBQ0UsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFBO0FBQ3ZCLENBQUM7QUFGRCxnQ0FFQztBQUVELG9CQUE0QixPQUFPO0lBQ2pDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDekIsSUFBSSxFQUFFLGtCQUFrQjtRQUN4QixZQUFZLEVBQUU7WUFDWixJQUFJLEVBQUU7Z0JBQ0osU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLFVBQVUsRUFBRSxJQUFJO2FBQ2pCO1NBQ0Y7UUFDRCxZQUFZLEVBQUU7WUFDWixRQUFRLEVBQUUsR0FBRztZQUNiLE9BQU8sRUFBRSxpQkFBaUI7U0FDM0I7UUFDRCxRQUFRLEVBQUUsQ0FBQyxHQUFHO1lBQ1osR0FBRyxHQUFHLEdBQUcsQ0FBQTtZQUNULGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQ3hCLENBQUM7S0FDRixDQUFDLENBQUE7SUFDRixXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUE7QUFDYixDQUFDO0FBcEJELGdDQW9CQztBQUVELDJCQUFrQyxNQUE0QixFQUFFLE1BQXVCLEVBQUUsSUFBWTs7UUFDbkcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFBO1FBQ2IsQ0FBQztRQUNELElBQUksRUFBb0IsQ0FBQTtRQUN4QixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QixFQUFFLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUM5QixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQyxJQUFJLENBQUE7WUFDYixDQUFDO1lBQ0QsTUFBTSxVQUFVLENBQUE7WUFDaEIsRUFBRSxHQUFHLElBQUksc0NBQWdCLENBQUMsVUFBVSxFQUFFLEVBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBQyxDQUFDLENBQUE7WUFDOUQsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDN0IsQ0FBQztRQUNELE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUNoRCxDQUFDO0NBQUE7QUFFRDtJQUNFLE1BQU0sQ0FBQztRQUNMLGFBQWEsRUFBRSxpQkFBaUI7UUFDaEMsdUJBQXVCLEVBQUUsMEJBQTBCO1FBQ25ELHFCQUFxQixFQUFFLE1BQU0sbUNBQW1DO1FBQ2hFLGlCQUFpQixFQUFFLENBQUM7UUFDcEIsY0FBYyxFQUFFLENBQUMsRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFDO1lBQy9CLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDaEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNWLE1BQU0sQ0FBQyxFQUFFLENBQUE7WUFDWCxDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDcEMsQ0FBQztLQUNGLENBQUE7QUFDSCxDQUFDO0FBZEQsZ0VBY0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0NvbXBvc2l0ZURpc3Bvc2FibGV9IGZyb20gJ2F0b20nXG5pbXBvcnQge0lkZUhhc2tlbGxSZXBsQmd9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iZydcbmltcG9ydCB7XG4gIElkZUhhc2tlbGxSZXBsVmlldyxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi92aWV3cy9pZGUtaGFza2VsbC1yZXBsLXZpZXcnXG5cbmV4cG9ydCAqIGZyb20gJy4vY29uZmlnJ1xuXG50eXBlIFVQSUludGVyZmFjZSA9IGFueVxubGV0IGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG5sZXQgZWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbFZpZXc+ID0gbmV3IFdlYWtNYXAoKVxubGV0IGJnRWRpdG9yTWFwOiBXZWFrTWFwPEF0b21UeXBlcy5UZXh0RWRpdG9yLCBJZGVIYXNrZWxsUmVwbEJnPiA9IG5ldyBXZWFrTWFwKClcbmxldCByZXNvbHZlVVBJUHJvbWlzZTogKHVwaTogVVBJSW50ZXJmYWNlKSA9PiB2b2lkXG5sZXQgdXBpUHJvbWlzZSA9IG5ldyBQcm9taXNlPFVQSUludGVyZmFjZT4oKHJlc29sdmUpID0+IHsgcmVzb2x2ZVVQSVByb21pc2UgPSByZXNvbHZlIH0pXG5sZXQgVVBJOiBVUElJbnRlcmZhY2VcblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlIChzdGF0ZSkge1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS53b3Jrc3BhY2UuYWRkT3BlbmVyKCh1cmlUb09wZW4sIG9wdGlvbnMpID0+IHtcbiAgICAgIGxldCBtID0gdXJpVG9PcGVuLm1hdGNoKC9eaWRlLWhhc2tlbGw6XFwvXFwvcmVwbFxcLyguKikkLylcbiAgICAgIGlmICghKG0gJiYgbVsxXSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICByZXR1cm4gY3JlYXRlUmVwbFZpZXcoe3VyaTogbVsxXX0pXG4gICAgfSksXG4gIClcblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUnOiBhc3luYyAoe2N1cnJlbnRUYXJnZXR9KSA9PiBvcGVuKGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKSksXG4gICAgfSksXG4gIClcblxuICBsZXQgY29tbWFuZEZ1bmN0aW9uID0gKGZ1bmMpID0+ICh7Y3VycmVudFRhcmdldH0pID0+IHtcbiAgICBsZXQgdmlldyA9IGVkaXRvck1hcC5nZXQoY3VycmVudFRhcmdldC5nZXRNb2RlbCgpKVxuICAgIGlmICh2aWV3KSB7IHZpZXdbZnVuY10oKSB9XG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3IuaWRlLWhhc2tlbGwtcmVwbCcsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmV4ZWMtY29tbWFuZCc6IGNvbW1hbmRGdW5jdGlvbignZXhlY0NvbW1hbmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktYmFjayc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUJhY2snKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmhpc3RvcnktZm9yd2FyZCc6IGNvbW1hbmRGdW5jdGlvbignaGlzdG9yeUZvcndhcmQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmdoY2ktcmVsb2FkJzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0JzogY29tbWFuZEZ1bmN0aW9uKCd0b2dnbGVBdXRvUmVsb2FkUmVwZWF0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLWludGVycnVwdCc6IGNvbW1hbmRGdW5jdGlvbignaW50ZXJydXB0JyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpjbGVhci1vdXRwdXQnOiBjb21tYW5kRnVuY3Rpb24oJ2NsZWFyJyksXG4gICAgfSksXG4gIClcblxuICBsZXQgZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24gPSAoZnVuYykgPT4gKHtjdXJyZW50VGFyZ2V0fSkgPT4ge1xuICAgIG9wZW4oY3VycmVudFRhcmdldC5nZXRNb2RlbCgpLCBmYWxzZSlcbiAgICAudGhlbigobW9kZWwpID0+IG1vZGVsW2Z1bmNdKCkpXG4gIH1cblxuICBkaXNwb3NhYmxlcy5hZGQoXG4gICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3I6bm90KC5pZGUtaGFza2VsbC1yZXBsKScsIHtcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOmNvcHktc2VsZWN0aW9uLXRvLXJlcGwtaW5wdXQnOiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgICAgIGxldCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBsZXQgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkKS50aGVuKChtb2RlbCkgPT4gbW9kZWwuY29weVRleHQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpydW4tc2VsZWN0aW9uLWluLXJlcGwnOiAoe2N1cnJlbnRUYXJnZXR9KSA9PiB7XG4gICAgICAgIGxldCBlZCA9IGN1cnJlbnRUYXJnZXQuZ2V0TW9kZWwoKVxuICAgICAgICBsZXQgY21kID0gZWQuZ2V0TGFzdFNlbGVjdGlvbigpLmdldFRleHQoKVxuICAgICAgICBvcGVuKGVkLCBmYWxzZSkudGhlbihhc3luYyAobW9kZWwpID0+IG1vZGVsLnJ1bkNvbW1hbmQoY21kKSlcbiAgICAgIH0sXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpnaGNpLXJlbG9hZCc6IGV4dGVybmFsQ29tbWFuZEZ1bmN0aW9uKCdnaGNpUmVsb2FkJyksXG4gICAgICAnaWRlLWhhc2tlbGwtcmVwbDpyZWxvYWQtcmVwZWF0JzogZXh0ZXJuYWxDb21tYW5kRnVuY3Rpb24oJ2doY2lSZWxvYWRSZXBlYXQnKSxcbiAgICAgICdpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQnOiBleHRlcm5hbENvbW1hbmRGdW5jdGlvbigndG9nZ2xlQXV0b1JlbG9hZFJlcGVhdCcpLFxuICAgIH0pLFxuICApXG5cbiAgZGlzcG9zYWJsZXMuYWRkKGF0b20ubWVudS5hZGQoW3tcbiAgICBsYWJlbDogJ0hhc2tlbGwgSURFJyxcbiAgICBzdWJtZW51OiBbe1xuICAgICAgbGFiZWw6ICdPcGVuIFJFUEwnLFxuICAgICAgY29tbWFuZDogJ2lkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlJyxcbiAgICB9XSxcbiAgfV0pKVxuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChyZXNvbHZlVVBJUHJvbWlzZSAmJiAhVVBJKSB7IHJlc29sdmVVUElQcm9taXNlKG51bGwpIH1cbiAgfSwgNTAwMClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlcGxWaWV3ICh7dXJpLCBjb250ZW50LCBoaXN0b3J5LCBhdXRvUmVsb2FkUmVwZWF0fTogSVZpZXdTdGF0ZSkge1xuICBsZXQgdmlldyA9IG5ldyBJZGVIYXNrZWxsUmVwbFZpZXcodXBpUHJvbWlzZSwge3VyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdH0pXG4gIGVkaXRvck1hcC5zZXQodmlldy5lZGl0b3IsIHZpZXcpXG4gIHJldHVybiB2aWV3XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW4gKGVkaXRvciwgYWN0aXZhdGUgPSB0cnVlKTogUHJvbWlzZTxJZGVIYXNrZWxsUmVwbFZpZXc+IHtcbiAgbGV0IGdyYW1tYXIgPSBlZGl0b3IgPyBlZGl0b3IuZ2V0R3JhbW1hcigpIDogbnVsbFxuICBsZXQgc2NvcGUgPSBncmFtbWFyID8gZ3JhbW1hci5zY29wZU5hbWUgOiBudWxsXG4gIGxldCB1cmlcbiAgaWYgKHNjb3BlICYmIHNjb3BlLmVuZHNXaXRoKCdoYXNrZWxsJykpIHtcbiAgICB1cmkgPSBlZGl0b3IuZ2V0VVJJKClcbiAgfSBlbHNlIHtcbiAgICB1cmkgPSAnJ1xuICB9XG4gIHJldHVybiBhdG9tLndvcmtzcGFjZS5vcGVuKGBpZGUtaGFza2VsbDovL3JlcGwvJHt1cml9YCwge1xuICAgIHNwbGl0OiAncmlnaHQnLFxuICAgIHNlYXJjaEFsbFBhbmVzOiB0cnVlLFxuICAgIGFjdGl2YXRlUGFuZTogYWN0aXZhdGUsXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWFjdGl2YXRlICgpIHtcbiAgZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lVVBJIChzZXJ2aWNlKSB7XG4gIGxldCBkaXNwID0gc2VydmljZS5jb25zdW1lKHtcbiAgICBuYW1lOiAnaWRlLWhhc2tlbGwtcmVwbCcsXG4gICAgbWVzc2FnZVR5cGVzOiB7XG4gICAgICByZXBsOiB7XG4gICAgICAgIHVyaUZpbHRlcjogZmFsc2UsXG4gICAgICAgIGF1dG9TY3JvbGw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdG9vbHRpcEV2ZW50OiB7XG4gICAgICBwcmlvcml0eTogMjAwLFxuICAgICAgaGFuZGxlcjogc2hvdWxkU2hvd1Rvb2x0aXAsXG4gICAgfSxcbiAgICBjb25zdW1lcjogKHVwaSkgPT4ge1xuICAgICAgVVBJID0gdXBpXG4gICAgICByZXNvbHZlVVBJUHJvbWlzZSh1cGkpXG4gICAgfSxcbiAgfSlcbiAgZGlzcG9zYWJsZXMuYWRkKGRpc3ApXG4gIHJldHVybiBkaXNwXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNob3VsZFNob3dUb29sdGlwIChlZGl0b3I6IEF0b21UeXBlcy5UZXh0RWRpdG9yLCBjcmFuZ2U6IEF0b21UeXBlcy5SYW5nZSwgdHlwZTogc3RyaW5nKSB7XG4gIGlmICghYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLnNob3dUeXBlcycpKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICBsZXQgYmc6IElkZUhhc2tlbGxSZXBsQmdcbiAgaWYgKGJnRWRpdG9yTWFwLmhhcyhlZGl0b3IpKSB7XG4gICAgYmcgPSBiZ0VkaXRvck1hcC5nZXQoZWRpdG9yKVxuICB9IGVsc2Uge1xuICAgIGlmICghZWRpdG9yLmdldFBhdGgoKSkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgYXdhaXQgdXBpUHJvbWlzZVxuICAgIGJnID0gbmV3IElkZUhhc2tlbGxSZXBsQmcodXBpUHJvbWlzZSwge3VyaTogZWRpdG9yLmdldFBhdGgoKX0pXG4gICAgYmdFZGl0b3JNYXAuc2V0KGVkaXRvciwgYmcpXG4gIH1cbiAgcmV0dXJuIGJnLnNob3dUeXBlQXQoZWRpdG9yLmdldFBhdGgoKSwgY3JhbmdlKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXV0b2NvbXBsZXRlUHJvdmlkZXJfM18wXzAgKCkge1xuICByZXR1cm4ge1xuICAgIHNjb3BlU2VsZWN0b3I6ICcuc291cmNlLmhhc2tlbGwnLFxuICAgIGRpc2FibGVGb3JTY29wZVNlbGVjdG9yOiAnLnNvdXJjZS5oYXNrZWxsIC5jb21tZW50JyxcbiAgICBnZXRUZXh0RWRpdG9yU2VsZWN0b3I6ICgpID0+ICdhdG9tLXRleHQtZWRpdG9yLmlkZS1oYXNrZWxsLXJlcGwnLFxuICAgIGluY2x1c2lvblByaW9yaXR5OiAwLFxuICAgIGdldFN1Z2dlc3Rpb25zOiAoe2VkaXRvciwgcHJlZml4fSkgPT4ge1xuICAgICAgbGV0IHZpZXcgPSBlZGl0b3JNYXAuZ2V0KGVkaXRvcilcbiAgICAgIGlmICghdmlldykge1xuICAgICAgICByZXR1cm4gW11cbiAgICAgIH1cbiAgICAgIHJldHVybiB2aWV3LmdldENvbXBsZXRpb25zKHByZWZpeClcbiAgICB9LFxuICB9XG59XG4iXX0=