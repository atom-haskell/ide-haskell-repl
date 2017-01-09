{Emitter, CompositeDisposable} = require 'atom'
CP = require 'child_process'
{EOL} = require 'os'
tkill = require 'tree-kill'
{hsEscapeString} = require 'atom-haskell-utils'

module.exports =
class GHCI
  constructor: (opts = {}) ->
    @disposables = new CompositeDisposable
    {cwd, atomPath, command, args, load, history} = opts
    @errorBuffer = []
    @responseBuffer = []
    @completeMode = false

    history ?= []
    @history =
      back: history
      curr: ''
      item: history.length

    @disposables.add @emitter = new Emitter

    events = ['onResponse', 'onError', 'onFinished', 'onExit', 'onInput', 'onMessage']
    for i in events when opts[i]?
      @[i](opts[i])

    handleError = (error) =>
      @emitter.emit 'response', "GHCI crashed\n#{error}"
      console.error error
      @ghci = null
      @emitter.emit 'exit', -1

    try
      @process =
        if process.platform is 'win32'
          spawnArgs = [command, args...]
          if cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath')
            spawnArgs.unshift("\"" + cmdexe + "\"")
          CP.spawn "chcp 65001 && ", spawnArgs,
            cwd: cwd
            stdio: ['pipe', 'pipe', 'pipe']
            shell: true
        else
          CP.spawn command, args,
            cwd: cwd
            stdio: ['pipe', 'pipe', 'pipe']


      buffered = (handleOutput) ->
        buffer = ''
        (data) ->
          output = data.toString('utf8')
          [first, mid..., last] = output.split(/\r?\n/)
          buffer += first
          if last? # it means there's at least one newline
            lines = [buffer, mid...]
            buffer = last
            handleOutput lines

      @process.stdout.on 'data', buffered (lines) =>
        lines = lines.map (line) ->
          if line.length > 10000
            line.slice(0, 10000) + '...'
          else
            line
        @responseBuffer.push lines...
        rx = /^#~IDEHASKELLREPL~(.*)~#$/
        rxres = rx.exec @responseBuffer.slice(-1)[0]
        if rxres?
          @finished = true
          @emitter.emit 'finished', rxres[1]
          unless @started
            @started = true
            @responseBuffer = []
            return

          @responseBuffer =
            if @responseBuffer.slice(-2)[0]
              @responseBuffer.slice(0, -1)
            else
              @responseBuffer.slice(0, -2)

          # TODO: Show that command finished
          @emitter.emit 'error', @errorBuffer.join('\n') + '\n'
          @errorBuffer = []
          if @response
            @emitter.emit 'response', @responseBuffer.join('\n') + '\n'
            @response = false
          else if @completeMode
            @emitter.emit 'complete', @responseBuffer
            @completeMode = false
          else
            @emitter.emit 'message', @responseBuffer.join('\n') + '\n'
          @responseBuffer = []
      @process.stderr.on 'data', buffered (lines) =>
        lines.forEach (line) ->
          console.warn "ide-haskell-repl: #{line}"
        @errorBuffer.push lines...
      @process.on 'exit', (code) =>
        @ghci = null
        if code isnt 0
          @emitter.emit 'error', @errorBuffer.join('\n') + '\n'
        @emitter.emit 'exit', code
        @disposables.dispose()

      @ghci = @process

      @load(load) if load
      @ghci.stdin.write ":set editor \"#{atomPath}\"#{EOL}"
      @ghci.stdin.write ":set prompt2 \"\"#{EOL}"
      @ghci.stdin.write ":set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"#{EOL}"
    catch error
      handleError error

  isActive: ->
    return !!@ghci

  onFinished: (callback) ->
    @emitter.on 'finished', callback

  onResponse: (callback) ->
    @emitter.on 'response', callback

  onMessage: (callback) ->
    @emitter.on 'message', callback

  onComplete: (callback) ->
    @emitter.on 'complete', callback

  onInput: (callback) ->
    @emitter.on 'input', callback

  onError: (callback) ->
    @emitter.on 'error', callback

  onExit: (callback) ->
    @emitter.on 'exit', callback

  load: (uri) ->
    return unless @isActive()
    @ghci.stdin.write ":load #{hsEscapeString uri}#{EOL}"

  reload: ->
    return unless @isActive()
    @ghci.stdin.write ":reload#{EOL}"

  reloadRepeat: ->
    return unless @isActive()
    return unless @history.back[@history.back.length - 1]?
    @reload()
    @writeLines([@history.back[@history.back.length - 1]])

  interrupt: ->
    if @ghci?
      if atom.config.get('ide-haskell-repl.ghciWrapperPath') and process.platform is 'win32'
        @ghci.stdin.write '\x03'
      else
        tkill @ghci.pid, 'SIGINT'
    @finished = true
    @emitter.emit 'response', 'Interrupted\n'

  writeLines: (lines) =>
    return false unless @isActive()
    return false unless @started
    if @finished
      if (text = lines.join(EOL)) and \
          @history.back[@history.back.length - 1] isnt text
        @history.back.push text
      @history.curr = ''
      @history.item = @history.back.length
      @finished = false
      @response = (not lines[0].startsWith ':') or lines[0].startsWith ':type' or lines[0].startsWith ':t'
      @errorBuffer = []
      @responseBuffer = []
      @ghci.stdin.write ":{#{EOL}#{lines.join(EOL)}#{EOL}:}#{EOL}"
      @emitter.emit 'input', lines.join('\n') + '\n'
      return true
    else unless @completeMode
      @ghci.stdin.write lines.join('\n')
      @emitter.emit 'input', "\"#{lines.join('\\n')}\"\n"
      return true
    else
      return false

  sendCompletionRequest: =>
    return false unless @isActive()
    return false unless @started
    if @finished
      @finished = false
      @completeMode = true
      @responseBuffer = []
      @ghci.stdin.write ":complete repl \"\"#{EOL}"
      true
    else
      false

  historyBack: (current) ->
    if @history.item is @history.back.length
      @history.curr = current
    @history.item -= 1
    if @history.item < 0
      @history.item = 0
    @history.back[@history.item] ? @history.curr

  historyForward: ->
    @history.item += 1
    if @history.item > @history.back.length
      @history.item = @history.back.length
    @history.back[@history.item] ? @history.curr

  # Tear down any state and detach
  destroy: ->
    return unless @isActive()
    @ghci.stdin.end()
    tkill @ghci.pid, 'SIGTERM'
