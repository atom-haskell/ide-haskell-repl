import {CompositeDisposable, TextEditor} from 'atom'
import {IdeHaskellReplBg} from './ide-haskell-repl-bg'
import {
  IdeHaskellReplView,
  IViewState,
} from './views/ide-haskell-repl-view'

export * from './config'

type UPIInterface = any
let disposables: CompositeDisposable
const editorMap: WeakMap<AtomTypes.TextEditor, IdeHaskellReplView> = new WeakMap()
const bgEditorMap: WeakMap<AtomTypes.TextEditor, IdeHaskellReplBg> = new WeakMap()
let resolveUPIPromise: (upi: UPIInterface) => void
const upiPromise = new Promise<UPIInterface>((resolve) => { resolveUPIPromise = resolve })
let UPI: UPIInterface

declare interface IEventDesc {
  currentTarget: HTMLElement & { getModel (): AtomTypes.TextEditor }
  abortKeyBinding? (): void
}

declare interface IState {
  // TODO
}

export function activate (state: IState) {
  disposables = new CompositeDisposable()

  disposables.add(
    atom.workspace.addOpener((uriToOpen: string) => {
      const m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/)
      if (!(m && m[1])) {
        return
      }
      return createReplView({uri: m[1]})
    }),
  )

  disposables.add(
    atom.commands.add('atom-text-editor', {
      'ide-haskell-repl:toggle': async ({currentTarget}: IEventDesc) => open(currentTarget.getModel()),
    }),
  )

  const commandFunction = (func: string) => ({currentTarget}: IEventDesc) => {
    const view = editorMap.get(currentTarget.getModel())
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

  const externalCommandFunction = (func: string) => ({currentTarget}: IEventDesc) => {
    open(currentTarget.getModel(), false)
    .then((model) => model[func]())
  }

  disposables.add(
    atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
      'ide-haskell-repl:copy-selection-to-repl-input': ({currentTarget}: IEventDesc) => {
        const ed = currentTarget.getModel()
        const cmd = ed.getLastSelection().getText()
        open(ed).then((model) => model.copyText(cmd))
      },
      'ide-haskell-repl:run-selection-in-repl': ({currentTarget}: IEventDesc) => {
        const ed = currentTarget.getModel()
        const cmd = ed.getLastSelection().getText()
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
  },         5000)
}

export function createReplView ({uri, content, history, autoReloadRepeat}: IViewState) {
  const view = new IdeHaskellReplView(upiPromise, {uri, content, history, autoReloadRepeat})
  editorMap.set(view.editor, view)
  return view
}

async function open (editor: TextEditor, activate = true): Promise<IdeHaskellReplView> {
  const grammar = editor ? editor.getGrammar() : null
  const scope = grammar ? grammar.scopeName : null
  let uri
  if (scope && scope.endsWith('haskell')) {
    uri = editor.getPath()
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

export function consumeUPI (service: UPI.IUPIService) {
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
  })
  resolveUPIPromise(UPI)
  disposables.add(UPI)
  return UPI
}

async function shouldShowTooltip (editor: AtomTypes.TextEditor, crange: AtomTypes.Range, type: string) {
  if (!atom.config.get('ide-haskell-repl.showTypes')) {
    return
  }
  // TODO: more effective bgEditorMap
  // should have one ghci instance per project component
  // not per file.
  let bg: IdeHaskellReplBg
  const bgt = bgEditorMap.get(editor)
  if (bgt) {
    bg = bgt
  } else {
    if (!editor.getPath()) {
      return
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
    getSuggestions: async ({editor, prefix}: {editor: TextEditor, prefix: string}) => {
      const view = editorMap.get(editor)
      if (!view) {
        return []
      }
      return view.getCompletions(prefix)
    },
  }
}
