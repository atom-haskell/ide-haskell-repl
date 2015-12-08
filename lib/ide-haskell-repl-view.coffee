SubAtom = require 'sub-atom'
{Range} = require 'atom'
GHCI = require './ghci'

module.exports =
class IdeHaskellReplView
  constructor: (@uri) ->
    # Create root element
    @disposables = new SubAtom

    # Create message element
    @element = document.createElement 'div'
    @element.classList.add('ide-haskell-repl')
    @element.appendChild @outputDiv = document.createElement 'div'
    @outputDiv.classList.add('ide-haskell-repl-output')
    @outputDiv.appendChild @outputElement =
      document.createElement('atom-text-editor')
    @outputElement.removeAttribute('tabindex')
    @output = @outputElement.getModel()
    @output.setSoftWrapped(true)
    @output.setLineNumberGutterVisible(false)
    @output.getDecorations(class: 'cursor-line', type: 'line')[0].destroy()
    @output.setGrammar \
      atom.grammars.grammarForScopeName 'text.tex.latex.haskell'
    @element.appendChild @errDiv = document.createElement 'div'
    @errDiv.classList.add 'ide-haskell-repl-error'
    @element.appendChild @promptDiv = document.createElement 'div'
    @element.appendChild @editorDiv = document.createElement 'div'
    @editorDiv.classList.add('ide-haskell-repl-editor')
    @editorDiv.appendChild @editorElement =
      document.createElement('atom-text-editor')
    @editorElement.classList.add 'ide-haskell-repl'
    @editor = @editorElement.getModel()
    @editor.setLineNumberGutterVisible(false)
    @editor.setGrammar \
      atom.grammars.grammarForScopeName 'source.haskell'

    setTimeout (=> @editorElement.focus()), 100

    @editorElement.onDidAttach =>
      @setEditorHeight()
    @editor.onDidChange =>
      @setEditorHeight()

    @editor.setText ''

    @output.onDidChange ({start, end}) =>
      @output.scrollToCursorPosition()

    @ghci = new GHCI
      atomPath: process.execPath
      command: atom.config.get 'ide-haskell-repl.commandPath'
      args: atom.config.get 'ide-haskell-repl.commandArgs'
      cwd: atom.project.getDirectories()[0].getPath()
      onResponse: (response) =>
        @log response
      onError: (error) =>
        @setError error
      onFinished: (prompt) =>
        @setPrompt prompt
      onExit: (code) =>
        atom.workspace.paneForItem(@)?.destroyItem?(@)

    @ghci.load(@uri) if @uri

  execCommand: ->
    if @ghci.writeLines @editor.getBuffer().getLines()
      @editor.setText ''

  historyBack: ->
    @editor.setText @ghci.historyBack(@editor.getText())

  historyForward: ->
    @editor.setText @ghci.historyForward()

  ghciReload: ->
    @ghci.writeLines [':reload']

  setEditorHeight: ->
    lh = @editor.getLineHeightInPixels()
    lines = @editor.getScreenLineCount()
    @editorDiv.style.setProperty 'height',
      "#{lines * lh}px"

  setPrompt: (prompt) ->
    @promptDiv.innerText = prompt + '>'

  setError: (err) ->
    @errDiv.innerText = err

  log: (text) ->
    eofRange = Range.fromPointWithDelta(@output.getEofBufferPosition(), 0, 0)
    @output.setTextInBufferRange eofRange, text
    @lastPos = @output.getEofBufferPosition()

  getURI: ->
    "ide-haskell://repl/#{@uri}"

  getTitle: ->
    "REPL: #{@uri}"

  destroy: ->
    @ghci.destroy()
    @element.remove()
