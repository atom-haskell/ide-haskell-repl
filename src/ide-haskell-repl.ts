import {CompositeDisposable} from 'atom'
import {IdeHaskellReplBg} from './ide-haskell-repl-bg'
import {
  IdeHaskellReplView,
  IViewState,
} from './views/ide-haskell-repl-view'

export * from './config'

type UPIInterface = any
let disposables: CompositeDisposable
let editorMap: WeakMap<AtomTypes.TextEditor, IdeHaskellReplView> = new WeakMap()
let bgEditorMap: WeakMap<AtomTypes.TextEditor, IdeHaskellReplBg> = new WeakMap()
let resolveUPIPromise: (upi: UPIInterface) => void
let upiPromise = new Promise<UPIInterface>((resolve) => { resolveUPIPromise = resolve })
let UPI: UPIInterface

export function activate (state) {
  disposables = new CompositeDisposable()

  disposables.add(
    atom.workspace.addOpener((uriToOpen, options) => {
      let m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/)
      if (!(m && m[1])) {
        return
      }
      return createReplView({uri: m[1]})
    }),
  )

  disposables.add(
    atom.commands.add('atom-text-editor', {
      'ide-haskell-repl:toggle': async ({currentTarget}) => open(currentTarget.getModel()),
    }),
  )

  let commandFunction = (func) => ({currentTarget}) => {
    let view = editorMap.get(currentTarget.getModel())
    if (view) { view[func]() }
  }

  disposables.add(
    atom.commands.add('atom-text-editor.ide-haskell-repl', {
      'ide-haskell-repl:exec-command': commandFunction('execCommand'),
      'ide-haskell-repl:history-back': commandFunction('historyBack'),
      'ide-haskell-repl:history-forward': commandFunction('historyForward'),
      'ide-haskell-repl:ghci-reload': commandFunction('ghciReload'),
      'ide-haskell-repl:reload-repeat': commandFunction('ghciReloadRepeat'),
      'ide-haskell-repl:toggle-auto-reload-repeat': commandFunction('toggleAutoReloadRepeat'),
      'ide-haskell-repl:ghci-interrupt': commandFunction('interrupt'),
      'ide-haskell-repl:clear-output': commandFunction('clear'),
    }),
  )

  let externalCommandFunction = (func) => ({currentTarget}) => {
    open(currentTarget.getModel(), false)
    .then((model) => model[func]())
  }

  disposables.add(
    atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
      'ide-haskell-repl:copy-selection-to-repl-input': ({currentTarget}) => {
        let ed = currentTarget.getModel()
        let cmd = ed.getLastSelection().getText()
        open(ed).then((model) => model.copyText(cmd))
      },
      'ide-haskell-repl:run-selection-in-repl': ({currentTarget}) => {
        let ed = currentTarget.getModel()
        let cmd = ed.getLastSelection().getText()
        open(ed, false).then(async (model) => model.runCommand(cmd))
      },
      'ide-haskell-repl:ghci-reload': externalCommandFunction('ghciReload'),
      'ide-haskell-repl:reload-repeat': externalCommandFunction('ghciReloadRepeat'),
      'ide-haskell-repl:toggle-auto-reload-repeat': externalCommandFunction('toggleAutoReloadRepeat'),
    }),
  )

  disposables.add(atom.menu.add([{
    label: 'Haskell IDE',
    submenu: [{
      label: 'Open REPL',
      command: 'ide-haskell-repl:toggle',
    }],
  }]))

  setTimeout(() => {
    if (resolveUPIPromise && !UPI) { resolveUPIPromise(null) }
  }, 5000)
}

export function createReplView ({uri, content, history, autoReloadRepeat}: IViewState) {
  let view = new IdeHaskellReplView(upiPromise, {uri, content, history, autoReloadRepeat})
  editorMap.set(view.editor, view)
  return view
}

async function open (editor, activate = true): Promise<IdeHaskellReplView> {
  let grammar = editor ? editor.getGrammar() : null
  let scope = grammar ? grammar.scopeName : null
  let uri
  if (scope && scope.endsWith('haskell')) {
    uri = editor.getURI()
  } else {
    uri = ''
  }
  return atom.workspace.open(`ide-haskell://repl/${uri}`, {
    split: 'right',
    searchAllPanes: true,
    activatePane: activate,
  })
}

export function deactivate () {
  disposables.dispose()
}

export function consumeUPI (service) {
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
      UPI = upi
      resolveUPIPromise(upi)
    },
  })
  disposables.add(disp)
  return disp
}

async function shouldShowTooltip (editor: AtomTypes.TextEditor, crange: AtomTypes.Range, type: string) {
  if (!atom.config.get('ide-haskell-repl.showTypes')) {
    return null
  }
  let bg: IdeHaskellReplBg
  if (bgEditorMap.has(editor)) {
    bg = bgEditorMap.get(editor)
  } else {
    if (!editor.getPath()) {
      return null
    }
    await upiPromise
    bg = new IdeHaskellReplBg(upiPromise, {uri: editor.getPath()})
    bgEditorMap.set(editor, bg)
  }
  return bg.showTypeAt(editor.getPath(), crange)
}

export function autocompleteProvider_3_0_0 () {
  return {
    scopeSelector: '.source.haskell',
    disableForScopeSelector: '.source.haskell .comment',
    getTextEditorSelector: () => 'atom-text-editor.ide-haskell-repl',
    inclusionPriority: 0,
    getSuggestions: ({editor, prefix}) => {
      let view = editorMap.get(editor)
      if (!view) {
        return []
      }
      return view.getCompletions(prefix)
    },
  }
}
