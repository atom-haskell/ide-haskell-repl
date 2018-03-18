import {
  CompositeDisposable,
  TWatchEditor,
  CommandEvent,
  TextEditor,
  TextEditorElement,
} from 'atom'
import { IdeHaskellReplView, IViewState } from './views/ide-haskell-repl-view'
import * as UPI from 'atom-haskell-upi'
import { UPIConsumer } from './upiConsumer'

export * from './config'

let disposables: CompositeDisposable
const editorMap: WeakMap<TextEditor, IdeHaskellReplView> = new WeakMap()
let resolveUPIPromise: (upi?: UPIConsumer) => void
let upiPromise: Promise<UPIConsumer | undefined>
let resolveWatchEditorPromise: (we: TWatchEditor) => void
const watchEditorPromise = new Promise<TWatchEditor>((resolve) => {
  resolveWatchEditorPromise = resolve
})

export function activate() {
  disposables = new CompositeDisposable()
  upiPromise = new Promise<UPIConsumer | undefined>((resolve) => {
    resolveUPIPromise = resolve
  })

  disposables.add(
    atom.workspace.addOpener((uriToOpen: string) => {
      const m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/)
      if (!(m && m[1])) {
        return undefined
      }
      return createReplView({ uri: m[1], focus: true })
    }),
  )

  disposables.add(
    atom.commands.add('atom-text-editor', {
      'ide-haskell-repl:toggle': async ({ currentTarget }) =>
        open(currentTarget.getModel()),
    }),
  )

  const commandFunction = (func: string) => ({
    currentTarget,
  }: CommandEvent<TextEditorElement>) => {
    const view = editorMap.get(currentTarget.getModel())
    if (view) {
      ;(view[func] as () => void)()
    }
  }

  disposables.add(
    atom.commands.add('atom-text-editor.ide-haskell-repl', {
      'ide-haskell-repl:exec-command': commandFunction('execCommand'),
      'ide-haskell-repl:history-back': commandFunction('historyBack'),
      'ide-haskell-repl:history-forward': commandFunction('historyForward'),
      'ide-haskell-repl:ghci-reload': commandFunction('ghciReload'),
      'ide-haskell-repl:reload-repeat': commandFunction('ghciReloadRepeat'),
      'ide-haskell-repl:toggle-auto-reload-repeat': commandFunction(
        'toggleAutoReloadRepeat',
      ),
      'ide-haskell-repl:ghci-interrupt': commandFunction('interrupt'),
      'ide-haskell-repl:clear-output': commandFunction('clear'),
    }),
  )

  const externalCommandFunction = (func: string) => ({
    currentTarget,
  }: CommandEvent<TextEditorElement>) => {
    // tslint:disable-next-line:no-floating-promises
    open(currentTarget.getModel(), false).then((model) =>
      (model[func] as () => void)(),
    )
  }

  disposables.add(
    atom.commands.add('atom-text-editor:not(.ide-haskell-repl)', {
      'ide-haskell-repl:copy-selection-to-repl-input': ({ currentTarget }) => {
        const ed = currentTarget.getModel()
        const cmd = ed.getLastSelection().getText()
        // tslint:disable-next-line:no-floating-promises
        open(ed).then((model) => model.copyText(cmd))
      },
      'ide-haskell-repl:run-selection-in-repl': ({ currentTarget }) => {
        const ed = currentTarget.getModel()
        const cmd = ed.getLastSelection().getText()
        // tslint:disable-next-line:no-floating-promises
        open(ed, false).then(async (model) => model.runCommand(cmd))
      },
      'ide-haskell-repl:ghci-reload': externalCommandFunction('ghciReload'),
      'ide-haskell-repl:reload-repeat': externalCommandFunction(
        'ghciReloadRepeat',
      ),
      'ide-haskell-repl:toggle-auto-reload-repeat': externalCommandFunction(
        'toggleAutoReloadRepeat',
      ),
    }),
  )

  disposables.add(
    atom.menu.add([
      {
        label: 'Haskell IDE',
        submenu: [
          {
            label: 'Open REPL',
            command: 'ide-haskell-repl:toggle',
          },
        ],
      },
    ]),
  )

  setTimeout(() => {
    resolveUPIPromise()
  }, 5000)
}

export function createReplView(state: IViewState) {
  const view = new IdeHaskellReplView({ upiPromise, state, watchEditorPromise })
  editorMap.set(view.editor, view)
  return view
}

async function open(
  editor: TextEditor,
  activate = true,
): Promise<IdeHaskellReplView> {
  const grammar = editor && editor.getGrammar()
  const scope = grammar && grammar.scopeName
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
  }) as Promise<IdeHaskellReplView>
}

export function deactivate() {
  disposables.dispose()
}

export function consumeUPI(register: UPI.IUPIRegistration) {
  const consumer = new UPIConsumer(register)
  disposables.add(consumer)
  resolveUPIPromise(consumer)
  return consumer
}

export function autocompleteProvider_3_0_0() {
  return {
    scopeSelector: '.source.haskell',
    disableForScopeSelector: '.source.haskell .comment',
    // getTextEditorSelector: () => 'atom-text-editor.ide-haskell-repl',
    inclusionPriority: 0,
    labels: ['ide-haskell-repl'],
    getSuggestions: async ({
      editor,
      prefix,
    }: {
      editor: TextEditor
      prefix: string
    }) => {
      const view = editorMap.get(editor)
      if (!view) {
        return []
      }
      return view.getCompletions(prefix)
    },
  }
}

export function consumeWatchEditor(watchEditor: TWatchEditor) {
  resolveWatchEditorPromise(watchEditor)
}
