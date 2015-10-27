IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'
url = require 'url'

module.exports = IdeHaskellRepl =
  config:
    atomPath:
      type: 'string'
      default: 'atom'
      description: '''
      Path to invoke Atom. Used for :edit command.
      '''
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

    @disposables.add atom.workspace.addOpener (uriToOpen, options) ->
      try
        { protocol, host, pathname } = url.parse uriToOpen
      catch error
        return

      return unless protocol is 'ide-haskell:' and host is 'repl'

      new IdeHaskellReplView(pathname.slice(1))

    @disposables.add atom.commands.add 'atom-text-editor',
      'ide-haskell-repl:toggle': ({target}) =>
        @open target.getModel()

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
