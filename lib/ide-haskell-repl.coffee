IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'
url = require 'url'

module.exports = IdeHaskellRepl =
  activate: (state) ->
    @disposables = new CompositeDisposable

    @disposables.add atom.workspace.addOpener (uriToOpen, options) ->
      try
        { protocol, host, pathname } = url.parse uriToOpen
      catch error
        return

      return unless protocol is 'ide-haskell:' and host is 'repl'

      new IdeHaskellReplView(pathname)

    @disposables.add atom.commands.add 'atom-text-editor',
      'ide-haskell-repl:toggle': ({target}) =>
        @open target.getModel()

  open: (editor) ->
    uri = editor.getURI?()
    atom.workspace.open "ide-haskell://repl/#{uri ? ''}",
      split: 'right'
      searchAllPanes: true

  deactivate: ->
    @disposables.dispose()

  serialize: ->
    ideHaskellReplViewState: @ideHaskellReplView.serialize()
