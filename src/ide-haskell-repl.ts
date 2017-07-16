import {CompositeDisposable, TextEditor} from 'atom'
import {IdeHaskellReplBase} from './ide-haskell-repl-base'
import {IdeHaskellReplBg} from './ide-haskell-repl-bg'
import {
  IdeHaskellReplView,
  IViewState,
} from './views/ide-haskell-repl-view'

export * from './config'

let disposables: CompositeDisposable
const editorMap: WeakMap<AtomTypes.TextEditor, IdeHaskellReplView> = new WeakMap()
const bgEditorMap: Map<string, IdeHaskellReplBg> = new Map()
let resolveUPIPromise: (upi?: UPI.IUPIInstance) => void
const upiPromise = new Promise<UPI.IUPIInstance>((resolve) => { resolveUPIPromise = resolve })
let UPI: UPI.IUPIInstance | undefined

declare interface IEventDesc {
  currentTarget: HTMLElement & { getModel (): AtomTypes.TextEditor }
  abortKeyBinding? (): void
}

export function activate () {
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
    if (resolveUPIPromise && !UPI) { resolveUPIPromise() }
  },         5000)
}

export function createReplView (state: IViewState) {
  const view = new IdeHaskellReplView({upiPromise, state})
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

export function consumeUPI (register: UPI.IUPIRegistration) {
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
  })
  resolveUPIPromise(UPI)
  disposables.add(UPI)
  return UPI
}

async function shouldShowTooltip (editor: AtomTypes.TextEditor, crange: AtomTypes.Range, type: string) {
  if (!atom.config.get('ide-haskell-repl.showTypes')) {
    return
  }
  const {cwd, cabal, comp} = await IdeHaskellReplBase.componentFromURI(editor.getPath())
  const hash = `${cwd.getPath()}::${cabal.name}::${comp[0]}`
  let bg = bgEditorMap.get(hash)
  if (!bg) {
    if (!editor.getPath()) {
      return
    }
    await upiPromise
    bg = new IdeHaskellReplBg(upiPromise, {uri: editor.getPath()})
    bgEditorMap.set(hash, bg)
  }
  return bg.showTypeAt(editor.getPath(), crange)
}

async function didSaveBuffer (buffer: AtomTypes.TextBuffer) {
  if (!atom.config.get('ide-haskell-repl.checkOnSave')) {
    return
  }
  const {cwd, cabal, comp} = await IdeHaskellReplBase.componentFromURI(buffer.getPath())
  const hash = `${cwd.getPath()}::${cabal.name}::${comp[0]}`
  const bgt = bgEditorMap.get(hash)
  if (bgt) {
    bgt.ghciReload()
  } else {
    if (!buffer.getPath()) {
      return
    }
    await upiPromise
    const bg = new IdeHaskellReplBg(upiPromise, {uri: buffer.getPath()})
    bgEditorMap.set(hash, bg)
  }
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
