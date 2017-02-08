SubAtom = require 'sub-atom'
{Range, Emitter} = require 'atom'
GHCI = require './ghci'
Util = require 'atom-haskell-utils'
highlightSync = require 'atom-highlight'
{filter} = require 'fuzzaldrin'

termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

module.exports =
class IdeHaskellReplView
  constructor: ({@uri, content, @history, upiPromise}) ->
    # Create root element
    @disposables = new SubAtom
    @disposables.add @emitter = new Emitter

    # Create message element
    @element = document.createElement 'div'
    @element.classList.add('ide-haskell-repl')

    @editorPromise = new Promise (resolveEditorPromise) =>
      upiPromise.then (@upi) =>
        atom.packages.getLoadedPackage('ide-haskell-repl').activationPromise
        .then =>
          @initialize(resolveEditorPromise, content)

  initialize: (resolveEditorPromise, content) ->
    @element.appendChild @outputDiv = document.createElement 'div'
    @outputDiv.classList.add('ide-haskell-repl-output', 'native-key-bindings')
    @outputDiv.tabIndex = -1
    @outputDiv.appendChild @outputElement = document.createElement('div')
    unless @upi?
      @element.appendChild @errDiv = document.createElement 'div'
      @errDiv.classList.add 'ide-haskell-repl-error'
    @element.appendChild @promptDiv = document.createElement 'div'
    @element.appendChild @editorDiv = document.createElement 'div'
    @editorDiv.classList.add('ide-haskell-repl-editor')
    @editorDiv.appendChild @editorContainer = document.createElement 'div'
    @editorContainer.classList.add 'editor-container'
    @editorContainer.appendChild @editorElement =
      document.createElement('atom-text-editor')
    @editorElement.classList.add 'ide-haskell-repl'
    @editorDiv.appendChild @interruptButton =
      document.createElement('button')
    @interruptButton.classList.add 'interrupt'
    @editor = @editorElement.getModel()
    atom.views.views.set @editor, @editorElement
    atom.textEditors.add @editor
    @editor.setLineNumberGutterVisible(false)
    setImmediate => @editor.setSoftWrapped(true)
    @editor.setGrammar \
      atom.grammars.grammarForScopeName 'source.haskell'

    @disposables.add atom.config.observe 'editor.fontSize', (fontSize) =>
      @outputDiv.style.fontSize = "#{fontSize}px" ? ''
    @disposables.add atom.config.observe 'editor.fontFamily', (fontFamily) =>
      @outputDiv.style.fontFamily = fontFamily ? ''

    @disposables.add @interruptButton, 'click', =>
      @interrupt()

    @editorElement.onDidAttach =>
      @setEditorHeight()
    @editor.onDidChange =>
      @setEditorHeight()

    @editor.setText ''

    resolveEditorPromise @editor

    @outputDiv.innerHTML = content if content?

    @cwd = Util.getRootDir @uri

    setImmediate =>
      return @runREPL() unless @upi?

      @upi.getConfigParam('ide-haskell-cabal', 'builder')
      .then (builder) =>
        @runREPL(builder?.name)
      .catch (error) =>
        if error?
          switch error.name
            when 'PackageInactiveError'
              @runREPL()
            else
              atom.notifications.addFatalError error.toString(),
                detail: error
                dismissable: true
              atom.workspace.paneForItem(@)?.destroyItem?(@)
        else
          atom.notifications.addWarning "Can't run REPL without knowing what builder to use"
          atom.workspace.paneForItem(@)?.destroyItem?(@)

  runREPL: (builder) ->
    @editorElement.focus()
    @disposables.add atom.workspace.onDidChangeActivePaneItem (item) =>
      if item == @
        setImmediate => @editorElement.focus()

    builder ?= atom.config.get 'ide-haskell-repl.defaultRepl'
    subst =
      'nix-build': 'cabal'
      'none': 'ghci'
    builder = subst[builder] ? builder

    [cabalFile] =
      @cwd.getEntriesSync().filter (file) ->
        file.isFile() and file.getBaseName().endsWith '.cabal'

    cabalContents = cabalFile?.readSync?()

    cabal = Util.parseDotCabalSync cabalContents

    [comp] = Util.getComponentFromFileSync cabalContents, @cwd.relativize(@uri)

    commandPath = atom.config.get "ide-haskell-repl.#{builder}Path"

    args =
      stack: ['ghci']
      cabal: ['repl']
      ghci: []
    extraArgs =
      stack: (x) -> "--ghci-options=\"#{x}\""
      cabal: (x) -> "--ghc-option=#{x}"
      ghci: (x) -> x

    commandArgs = args[builder] ? throw new Error("Unknown builder #{builder}")

    commandArgs.push (atom.config.get('ide-haskell-repl.extraArgs').map extraArgs[builder])...

    if comp?
      if builder is 'stack'
        if comp.startsWith 'lib:'
          comp = 'lib'
        comp = "#{cabal.name}:#{comp}"
        commandArgs.push '--main-is', comp
      else
        commandArgs.push comp

    @ghci = new GHCI
      atomPath: process.execPath
      command: commandPath
      args: commandArgs
      cwd: @cwd.getPath()
      load: @uri
      history: @history
      onResponse: (response) =>
        @log response.replace(termEscapeRx, '')
      onInput: (input) =>
        @logInput input.replace(termEscapeRx, '')
      onMessage: (message) =>
        @logMessage message.replace(termEscapeRx, '')
      onError: (error) =>
        @setError error.replace(termEscapeRx, '')
      onFinished: (prompt) =>
        @setPrompt prompt.replace(termEscapeRx, '')
      onExit: (code) =>
        atom.workspace.paneForItem(@)?.destroyItem?(@)

  execCommand: ->
    if @ghci.writeLines @editor.getBuffer().getLines()
      @editor.setText ''

  copyText: (command) ->
    @editor.setText command
    @editorElement.focus()

  runCommand: (command) ->
    unless @ghci?.finished and @ghci?.writeLines?(command.split('\n'))
      setTimeout (=> @runCommand(command)), 100

  historyBack: ->
    @editor.setText @ghci.historyBack(@editor.getText())

  historyForward: ->
    @editor.setText @ghci.historyForward()

  ghciReload: ->
    @ghci.reload()

  ghciReloadRepeat: ->
    return unless @ghci?
    @ghci.reloadRepeat()

  interrupt: ->
    @ghci?.interrupt()

  setEditorHeight: ->
    lh = @editor.getLineHeightInPixels()
    lines = @editor.getScreenLineCount()
    @editorDiv.style.setProperty 'height',
      "#{lines * lh}px"

  setPrompt: (prompt) ->
    @promptDiv.innerText = prompt + '>'

  getCompletions: (prefix) =>
    return [] unless prefix.trim()
    new Promise (resolve, reject) =>
      unless @ghci.sendCompletionRequest()
        @completionHandler?.dispose?()
      @completionHandler = @ghci.onComplete (lines) =>
        lines_ =
          lines.slice(1)
          .map (line) -> line.slice(1, -1)
        suggestions =
          filter(lines_, prefix)
          .map (result) -> text: result
        resolve suggestions
        @completionHandler.dispose()

  setError: (err) ->
    if @errDiv?
      @errDiv.innerText = err.trim()
    else
      @upi.setMessages @splitErrBuffer err

  splitErrBuffer: (errBuffer) ->
    # Start of a Cabal message
    startOfMessage = /\n\S/
    som = errBuffer.search startOfMessage
    msgs = while som >= 0
      errMsg     = errBuffer.substr(0, som + 1)
      errBuffer = errBuffer.substr(som + 1)
      som        = errBuffer.search startOfMessage
      @parseMessage errMsg
    # Try to parse whatever is left in the buffer
    msgs.push @parseMessage errBuffer
    msgs.filter (msg) -> msg?

  unindentMessage: (message) ->
    lines = message.split('\n')
    minIndent = null
    for line in lines
      match = line.match /^[\t\s]*/
      lineIndent = match[0].length
      minIndent = lineIndent if lineIndent < minIndent or not minIndent?
    if minIndent?
      lines = for line in lines
        line.slice(minIndent)
    lines.join('\n')

  parseMessage: (raw) ->
    # Regular expression to match against a location in a cabal msg (Foo.hs:3:2)
    # The [^] syntax basically means "anything at all" (including newlines)
    matchLoc = /(\S+):(\d+):(\d+):( Warning:)?\n?([^]*)/
    if raw.trim() != ""
      matched = raw.match(matchLoc)
      if matched?
        [file, line, col, rawTyp, msg] = matched.slice(1, 6)
        typ = if rawTyp? then "warning" else "error"
        if file is '<interactive>'
          file = undefined
          typ = 'repl'

        uri: if file? then @cwd.getFile(@cwd.relativize(file)).getPath()
        position: [parseInt(line) - 1, parseInt(col) - 1]
        message: @unindentMessage(msg.trimRight())
        severity: typ
      else
        message: raw
        severity: 'repl'

  log: (text) ->
    pre = document.createElement('pre')
    pre.classList.add 'ide-haskell-repl-output-text'
    pre.innerHTML = highlightSync(fileContents: text, scopeName: 'source.haskell', nbsp: false)
    @outputDiv.appendChild pre
    pre.scrollIntoView()

  logInput: (text) ->
    pre = document.createElement('pre')
    pre.classList.add 'ide-haskell-repl-input-text'
    pre.innerHTML = highlightSync(fileContents: text, scopeName: 'source.haskell', nbsp: false)
    @outputDiv.appendChild pre
    pre.scrollIntoView()

  logMessage: (text) ->
    pre = document.createElement('pre')
    pre.classList.add 'ide-haskell-repl-message-text'
    pre.innerText = text
    @outputDiv.appendChild pre
    pre.scrollIntoView()

  getURI: ->
    "ide-haskell://repl/#{@uri}"

  getTitle: ->
    "REPL: #{@uri}"

  onDidDestroy: (callback) ->
    @emitter.on 'did-destroy', callback

  destroy: ->
    @ghci?.destroy?()
    atom.textEditors.remove @editor
    @element.remove()
    @emitter.emit 'did-destroy'
    @disposables.dispose()

  serialize: ->
    deserializer: 'IdeHaskellReplView'
    uri: @uri
    upi: @upi?
    content: @outputDiv.innerHTML
    history: @ghci.history.back
