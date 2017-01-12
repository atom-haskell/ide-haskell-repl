IdeHaskellReplView = require './ide-haskell-repl-view'
{CompositeDisposable} = require 'atom'

module.exports = IdeHaskellRepl =
  config:
    defaultRepl:
      type: 'string'
      enum: [ 'stack', 'cabal', 'ghci' ]
      default: 'ghci'
      order: 0
    stackPath:
      type: 'string'
      default: 'stack'
      description: '''
      Path to stack executable
      '''
      order: 10
    cabalPath:
      type: 'string'
      default: 'cabal'
      description: '''
      Path to cabal executable
      '''
      order: 20
    ghciPath:
      type: 'string'
      default: 'ghci'
      description: '''
      Path to ghci executable
      '''
      order: 30
    extraArgs:
      type: 'array'
      default: []
      description: 'Extra arguments passed to ghci. Comma-separated'
      items:
        type: 'string'
      order: 40
    autoReloadRepeat:
      type: 'boolean'
      default: false
      description: 'Automatically reload and repeat last command on file save.
                    This is only the default. You can toggle this per-editor
                    using ide-haskell-repl:toggle-auto-reload-repeat command'
      order: 50
    ghciWrapperPath:
      type: 'string'
      default: ''
      description: 'This is intended to fix the "interrupt closes ghci" problem
                    in Atom -- see README for details. This option has no
                    effect on other platforms'
      order: 999
  activate: (state) ->
    @disposables = new CompositeDisposable
    @editorMap = new WeakMap
    @autoRepeatMap = new WeakMap

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
      'ide-haskell-repl:ghci-interrupt': commandFunction 'interrupt'

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
      'ide-haskell-repl:reload-repeat':  ({currentTarget}) =>
        @open(currentTarget.getModel(), false)
        .then (model) ->
          model.ghciReloadRepeat()
      'ide-haskell-repl:toggle-auto-reload-repeat':  ({currentTarget}) =>
        ed = currentTarget.getModel()
        if @autoRepeatMap.has(ed)
          old = @autoRepeatMap.get(ed) ? atom.config.get('ide-haskell-repl.autoReloadRepeat')
          @autoRepeatMap.set(ed, not old)

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

  createReplView: ({uri, upi, content, history}) ->
    upiPromise =
      if upi and not @upi?
        new Promise (@resolveUPIPromise) =>
      else
        Promise.resolve(@upi)
    view = new IdeHaskellReplView({uri, content, history, upiPromise})
    view.editorPromise.then (editor) => @editorMap.set(editor, view)
    return view

  open: (editor, activate = true) ->
    if editor?.getGrammar?()?.scopeName?.endsWith? 'haskell'
      uri = editor?.getURI?()
    atom.workspace.open "ide-haskell://repl/#{uri ? ''}",
      split: 'right'
      searchAllPanes: true
      activatePane: activate
    .then (model) =>
      disp = new CompositeDisposable
      @autoRepeatMap.set(editor, atom.config.get('ide-haskell-repl.autoReloadRepeat'))
      disp.add editor.onDidSave =>
        if @autoRepeatMap.get(editor)
          model.ghciReloadRepeat()
      disp.add editor.onDidDestroy ->
        disp.dispose()
      disp.add model.onDidDestroy ->
        disp.dispose()
      return model

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
