IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'
url = require 'url'

module.exports = IdeHaskellRepl =
  ideHaskellReplView: null
  modalPanel: null
  subscriptions: null

  activate: (state) ->
    atom.workspace.addOpener (uriToOpen, options) ->
      try
        { protocol, host, pathname } = url.parse uriToOpen
      catch error
        return

      return unless protocol is 'ide-haskell:' and host is 'repl'

      new IdeHaskellReplView(pathname)

    # Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    @subscriptions = new CompositeDisposable

    # Register command that toggles this view
    @subscriptions.add atom.commands.add 'atom-text-editor',
      'ide-haskell-repl:toggle': ({target}) =>
        @toggle(target.getModel())

  deactivate: ->
    @modalPanel.destroy()
    @subscriptions.dispose()
    @ideHaskellReplView.destroy()

  serialize: ->
    ideHaskellReplViewState: @ideHaskellReplView.serialize()

  toggle: (editor) ->
    console.log 'IdeHaskellRepl was toggled!'
    uri = editor.getURI()

    options =
      split: 'right'
      searchAllPanes: true

    atom.workspace.open "ide-haskell://repl/#{uri}", options
