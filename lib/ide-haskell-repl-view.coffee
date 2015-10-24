SubAtom = require 'sub-atom'
{Range, BufferedProcess} = require 'atom'
{EOL} = require 'os'
tkill = require 'tree-kill'

module.exports =
class IdeHaskellReplView
  constructor: (@uri) ->
    # Create root element
    @disposables = new SubAtom

    # Create message element
    @element = document.createElement 'div'
    @element.classList.add('ide-haskell-repl')
    @[0]=@element
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
    @element.appendChild @errDiv = document.createElement 'pre'
    @element.appendChild @editorDiv = document.createElement 'div'
    @editorDiv.classList.add('ide-haskell-repl-editor')
    @editorDiv.appendChild @editorElement =
      document.createElement('atom-text-editor')
    @editor = @editorElement.getModel()
    @editor.setLineNumberGutterVisible(false)
    @editor.setGrammar \
      atom.grammars.grammarForScopeName 'source.haskell'
    setEditorHeight = =>
      lh = @editor.getLineHeightInPixels()
      lines = @editor.getScreenLineCount()
      @editorDiv.style.setProperty 'height',
        "#{lines*lh}px"

    @editorElement.onDidAttach -> setEditorHeight()
    @editor.onDidChange ->
      setEditorHeight()

    @editor.setText ''

    writeAtEOF = (editor, text) =>
      eofRange = Range.fromPointWithDelta(editor.getEofBufferPosition(),0,0)
      editor.setTextInBufferRange eofRange, text
      @lastPos = editor.getEofBufferPosition()

    @output.onDidChange ({start, end}) =>
      @output.scrollToCursorPosition()

    @process = new BufferedProcess
      command: 'cabal'
      args: ['repl']
      options:
        cwd: atom.project.getDirectories()[0].getPath()
      stdout: (output) =>
        lines = output.toString().split(EOL).slice(0,-1) #last line is empty
        lines = lines.map (line) ->
          if line.length > 10000
            line.slice(0,10000) + '...'
          else
            line
        if lines.slice(-1)[0] is '#~IDEHASKELLREPL~#'
          lines =
            if lines.slice(-2)[0]
              lines.slice(0,-1)
            else
              lines.slice(0,-2)
          if @timeout?
            clearTimeout @timeout
            @timeout = null
          @finished = true
          # TODO: Show that command finished
        if @response
          lines = lines.map((line)->"< #{line}")
        writeAtEOF @output, lines.join(EOL)
      stderr: (output) =>
        @errDiv.innerText +=
          output.toString().split(EOL).filter((l)->l).join(EOL)+EOL
      exit: (code) -> console.log("repl exited with #{code}")

    ghci = @process.process

    ghci.stdin.write(":set prompt \"\\n#~IDEHASKELLREPL~#\\n\"#{EOL}")
    ghci.stdin.write(":set prompt2 \"\"#{EOL}")
    ghci.stdin.write(":set editor atom #{EOL}")
    ghci.stdin.write(":load #{@uri}#{EOL}")

    writeLines = (lines) =>
      @response = (not lines[0].startsWith ':') or lines[0].startsWith ':type'
      ghci.stdout.pause()
      ghci.stdin.write ":{#{EOL}"
      lines.forEach (line) =>
        ghci.stdin.write line+EOL
        writeAtEOF @output, EOL+'> '+line
      writeAtEOF @output, EOL
      ghci.stdin.write ":}#{EOL}"
      @editor.setText ''
      ghci.stdout.resume()

    backHistory = []
    forwHistory = []
    current = ''
    @disposables.add @element, "keydown", ({keyCode, shiftKey}) =>
      if shiftKey
        switch keyCode
          when 13
            if @finished and not @timeout?
              backHistory.push forwHistory...
              forwHistory = []
              backHistory.push @editor.getText()
              @errDiv.innerText = ''
              writeLines @editor.getBuffer().getLines()
              @timeout = setTimeout (=>
                tkill ghci.pid, 'SIGINT'
                @finished = true
                @timeout = null
                ), 1000
              @finished = false
          when 38
            if forwHistory.length is 0
              current = @editor.getText()
            h = backHistory.pop()
            if h?
              forwHistory.push h
              @editor.setText h
          when 40
            h = forwHistory.pop()
            if h?
              backHistory.push h
              @editor.setText h
            else
              @editor.setText current

  getURI: ->
    "ide-haskell://repl/#{@uri}"

  getTitle: ->
    "REPL: #{@uri}"

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @process.process.stdin.end()
    @process.process.kill()
    @element.remove()
