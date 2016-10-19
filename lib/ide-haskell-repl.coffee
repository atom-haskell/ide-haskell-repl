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
  activate: (state) ->
    @disposables = new CompositeDisposable
    @editorMap = new WeakMap
    @autoRepeatMap = new WeakMap

    @disposables.add atom.workspace.addOpener (uriToOpen, options) =>
      m = uriToOpen.match(/^ide-haskell:\/\/repl\/(.*)$/)
      unless m? and m[1]?
        return
      pathname = m[1]

      view = new IdeHaskellReplView(pathname, @upi)
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
      'ide-haskell-repl:ghci-interrupt': commandFunction 'interrupt'

    @disposables.add atom.commands.add 'atom-text-editor:not(.ide-haskell-repl)',
      'ide-haskell-repl:copy-selection-to-repl-input':  ({target}) =>
        ed = target.getModel()
        cmd = ed.getLastSelection().getText()
        @open(ed)
        .then (model) ->
          model.copyText(cmd)
      'ide-haskell-repl:run-selection-in-repl':  ({target}) =>
        ed = target.getModel()
        cmd = ed.getLastSelection().getText()
        @open(ed, false)
        .then (model) ->
          model.runCommand(cmd)
      'ide-haskell-repl:reload-repeat':  ({target}) =>
        @open(target.getModel(), false)
        .then (model) ->
          model.ghciReloadRepeat()
      'ide-haskell-repl:toggle-auto-reload-repeat':  ({target}) =>
        ed = target.getModel()
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

  deactivate: ->
    @disposables.dispose()

  consumeUPI: (service) ->
    @upi = service.registerPlugin upiDisposables = new CompositeDisposable
    @disposables.add upiDisposables

    @upi.setMessageTypes
      repl:
        uriFilter: false
        autoScroll: true

    # upi.setMenu 'Cabal', [
    #     {label: 'Build Project', command: 'ide-haskell-cabal:build'}
    #     {label: 'Clean Project', command: 'ide-haskell-cabal:clean'}
    #     {label: 'Set Build Target', command: 'ide-haskell-cabal:set-build-target'}
    #     {label: 'Test', command: 'ide-haskell-cabal:test'}
    #   ]

    upiDisposables
