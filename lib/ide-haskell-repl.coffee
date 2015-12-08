IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'
url = require 'url'

module.exports = IdeHaskellRepl =
  config:
    commandPath:
      type: 'string'
      default: 'cabal'
      description: '''
      Path to REPL command, e.g. ghci, cabal or stack.
      '''
    commandArgs:
      type: 'array'
      default: ['repl']
      items:
        type: 'string'
      description: '''
      Comma-separated REPL command arguments, repl for cabal, ghci for stack,
      or none for ghci.
      '''
  activate: (state) ->
    @disposables = new CompositeDisposable
    @editorMap = new WeakMap

    @disposables.add atom.workspace.addOpener (uriToOpen, options) =>
      try
        { protocol, host, pathname } = url.parse uriToOpen
      catch error
        return

      return unless protocol is 'ide-haskell:' and host is 'repl'

      view = new IdeHaskellReplView(pathname.slice(1))
      @editorMap.set(view.editor, view)
      return view

    @disposables.add atom.commands.add 'atom-text-editor',
      'ide-haskell-repl:toggle': ({target}) =>
        @open target.getModel()

    commandFunction = (func) => ({target}) =>
      view = @editorMap.get(target.getModel())
      if view?
        view[func]()

    @disposables.add atom.commands.add 'atom-text-editor.ide-haskell-repl',
      'ide-haskell-repl:exec-command': commandFunction 'execCommand'
      'ide-haskell-repl:history-back': commandFunction 'historyBack'
      'ide-haskell-repl:history-forward': commandFunction 'historyForward'
      'ide-haskell-repl:ghci-reload': commandFunction 'ghciReload'

    setDefaultCommand = (command, key) ->
      command = "ide-haskell-repl:#{command}"
      unless atom.keymaps.findKeyBindings({command}).length
        o = {}
        o[key] = command
        atom.keymaps.add 'ide-haskell-repl',
          'atom-text-editor.ide-haskell-repl': o

    defaultCommands =
      'shift-enter': 'exec-command'
      'shift-up': 'history-back'
      'shift-down': 'history-forward'
      'ctrl-shift-r': 'ghci-reload'

    for key, command of defaultCommands
      setDefaultCommand command, key

    @disposables.add atom.menu.add [
      'label': 'Haskell IDE'
      'submenu': [
        'label': 'Open REPL'
        'command': 'ide-haskell-repl:toggle'
      ]
    ]

  open: (editor) ->
    if editor?.getGrammar?()?.scopeName?.endsWith? 'haskell'
      uri = editor?.getURI?()
    atom.workspace.open "ide-haskell://repl/#{uri ? ''}",
      split: 'right'
      searchAllPanes: true

  deactivate: ->
    @disposables.dispose()
