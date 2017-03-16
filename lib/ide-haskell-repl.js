'use babel';
import { CompositeDisposable } from 'atom';
import config from './config';
import IdeHaskellReplView from './ide-haskell-repl-view';
export default {
    config,
    activate(state) {
        this.disposables = new CompositeDisposable();
        if (!this.editorMap) {
            this.editorMap = new WeakMap();
        }
        this.disposables.add(atom.workspace.addOpener((uriToOpen, options) => {
            let m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/);
            if (!(m && m[1])) {
                return;
            }
            return this.createReplView({ uri: m[1] });
        }));
        this.disposables.add(atom.commands.add('atom-text-editor', {
            'ide-haskell-repl:toggle': ({ currentTarget }) => this.open(currentTarget.getModel()),
        }));
        let commandFunction = (func) => ({ currentTarget }) => {
            let view = this.editorMap.get(currentTarget.getModel());
            if (view) {
                view[func]();
            }
        };
        this.disposables.add(atom.commands.add('atom-text-editor.ide-haskell-repl', {
            'ide-haskell-repl:exec-command': commandFunction('execCommand'),
            'ide-haskell-repl:history-back': commandFunction('historyBack'),
            'ide-haskell-repl:history-forward': commandFunction('historyForward'),
            'ide-haskell-repl:ghci-reload': commandFunction('ghciReload'),
            'ide-haskell-repl:reload-repeat': commandFunction('ghciReloadRepeat'),
            'ide-haskell-repl:toggle-auto-reload-repeat': commandFunction('toggleAutoReloadRepeat'),
            'ide-haskell-repl:ghci-interrupt': commandFunction('interrupt'),
        }));
        let externalCommandFunction = (func) => ({ currentTarget }) => {
            this.open(currentTarget.getModel(), false)
                .then((model) => model[func]());
        };
        this.disposables.add(atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
            'ide-haskell-repl:copy-selection-to-repl-input': ({ currentTarget }) => {
                let ed = currentTarget.getModel();
                let cmd = ed.getLastSelection().getText();
                this.open(ed).then((model) => model.copyText(cmd));
            },
            'ide-haskell-repl:run-selection-in-repl': ({ currentTarget }) => {
                let ed = currentTarget.getModel();
                let cmd = ed.getLastSelection().getText();
                this.open(ed, false).then((model) => model.runCommand(cmd));
            },
            'ide-haskell-repl:ghci-reload': externalCommandFunction('ghciReload'),
            'ide-haskell-repl:reload-repeat': externalCommandFunction('ghciReloadRepeat'),
            'ide-haskell-repl:toggle-auto-reload-repeat': externalCommandFunction('toggleAutoReloadRepeat'),
        }));
        this.disposables.add(atom.menu.add([{
                label: 'Haskell IDE',
                submenu: [{
                        label: 'Open REPL',
                        command: 'ide-haskell-repl:toggle',
                    }],
            }]));
        setTimeout(() => {
            if (this.resolveUPIPromise && !this.upi) {
                this.resolveUPIPromise(null);
            }
        }, 5000);
    },
    createReplView({ uri, upi, content, history, autoReloadRepeat }) {
        let upiPromise;
        if (upi && !this.upi) {
            upiPromise = new Promise((resolve) => { this.resolveUPIPromise = resolve; });
        }
        else {
            upiPromise = Promise.resolve(this.upi);
        }
        let view = new IdeHaskellReplView({ uri, content, history, upiPromise, autoReloadRepeat });
        if (!this.editorMap) {
            this.editorMap = new WeakMap();
        }
        this.editorMap.set(view.editor, view);
        return view;
    },
    open(editor, activate = true) {
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
    },
    deactivate() {
        this.disposables.dispose();
    },
    consumeUPI(service) {
        let disp = service.consume({
            name: 'ide-haskell-repl',
            messageTypes: {
                repl: {
                    uriFilter: false,
                    autoScroll: true,
                },
            },
            consumer: (upi) => {
                if (this.resolveUPIPromise) {
                    this.resolveUPIPromise(upi);
                }
                this.upi = upi;
            },
        });
        this.disposables.add(disp);
        return disp;
    },
    autocompleteProvider_3_0_0() {
        return {
            scopeSelector: '.source.haskell',
            disableForScopeSelector: '.source.haskell .comment',
            getTextEditorSelector: () => 'atom-text-editor.ide-haskell-repl',
            inclusionPriority: 0,
            getSuggestions: ({ editor, prefix }) => {
                if (!this.editorMap) {
                    return [];
                }
                let view = this.editorMap.get(editor);
                if (!view) {
                    return [];
                }
                return view.getCompletions(prefix);
            },
        };
    },
};
