IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'

module.exports = IdeHaskellRepl =
  config: require('./config')
  activate: (state) ->
    @disposables = new CompositeDisposable
    @editorMap = new WeakMap

    @disposables.add atom.workspace.addOpener (uriToOpen, options) =>
      m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/)
      unless m? and m[1]?
        return
      return @createReplView(uri: m[1])

    @disposables.add atom.commands.add 'atom-text-editor',
      'ide-haskell-repl:toggle': ({currentTarget}) =>
        @open currentTarget.getModel()

    commandFunction = (func) => ({currentTarget}) =>
      view = @editorMap.get(currentTarget.getModel())
      if view?
        view[func]()

    @disposables.add atom.commands.add 'atom-text-editor.ide-haskell-repl',
      'ide-haskell-repl:exec-command': commandFunction 'execCommand'
      'ide-haskell-repl:history-back': commandFunction 'historyBack'
      'ide-haskell-repl:history-forward': commandFunction 'historyForward'
      'ide-haskell-repl:ghci-reload': commandFunction 'ghciReload'
      'ide-haskell-repl:ghci-reload': commandFunction 'ghciReload'
      'ide-haskell-repl:reload-repeat': commandFunction 'ghciReloadRepeat'
      'ide-haskell-repl:toggle-auto-reload-repeat': commandFunction 'toggleAutoReloadRepeat'
      'ide-haskell-repl:ghci-interrupt': commandFunction 'interrupt'

    externalCommandFunction = (func) => ({currentTarget}) =>
      @open(currentTarget.getModel(), false)
      .then (model) ->
        model[func]()

    @disposables.add atom.commands.add 'atom-text-editor:not(.ide-haskell-repl)',
      'ide-haskell-repl:copy-selection-to-repl-input':  ({currentTarget}) =>
        ed = currentTarget.getModel()
        cmd = ed.getLastSelection().getText()
        @open(ed)
        .then (model) ->
          model.copyText(cmd)
      'ide-haskell-repl:run-selection-in-repl':  ({currentTarget}) =>
        ed = currentTarget.getModel()
        cmd = ed.getLastSelection().getText()
        @open(ed, false)
        .then (model) ->
          model.runCommand(cmd)
      'ide-haskell-repl:ghci-reload': externalCommandFunction 'ghciReload'
      'ide-haskell-repl:reload-repeat': externalCommandFunction 'ghciReloadRepeat'
      'ide-haskell-repl:toggle-auto-reload-repeat': externalCommandFunction 'toggleAutoReloadRepeat'

    @disposables.add atom.menu.add [
      'label': 'Haskell IDE'
      'submenu': [
        'label': 'Open REPL'
        'command': 'ide-haskell-repl:toggle'
      ]
    ]

    setTimeout (=>
      if @resolveUPIPromise? and not @upi?
        @resolveUPIPromise(null)
      ), 5000

  createReplView: ({uri, upi, content, history, autoReloadRepeat}) ->
    upiPromise =
      if upi and not @upi?
        new Promise (@resolveUPIPromise) =>
      else
        Promise.resolve(@upi)
    view = new IdeHaskellReplView({uri, content, history, upiPromise, autoReloadRepeat})
    view.editorPromise.then (editor) => @editorMap.set(editor, view)
    return view

  open: (editor, activate = true) ->
    if editor?.getGrammar?()?.scopeName?.endsWith? 'haskell'
      uri = editor?.getURI?()
    atom.workspace.open "ide-haskell://repl/#{uri ? ''}",
      split: 'right'
      searchAllPanes: true
      activatePane: activate

  deactivate: ->
    @disposables.dispose()

  consumeUPI: (service) ->
    @upi = service.registerPlugin upiDisposables = new CompositeDisposable
    @resolveUPIPromise @upi if @resolveUPIPromise
    @disposables.add upiDisposables

    @upi.setMessageTypes
      repl:
        uriFilter: false
        autoScroll: true

    upiDisposables

  autocompleteProvider_3_0_0: ->
    scopeSelector: '.source.haskell'
    disableForScopeSelector: '.source.haskell .comment'
    getTextEditorSelector: ->
      'atom-text-editor.ide-haskell-repl'
    inclusionPriority: 0
    getSuggestions: ({editor, prefix}) =>
      return [] unless @editorMap
      view = @editorMap.get editor
      return [] unless view?
      view.getCompletions(prefix)
