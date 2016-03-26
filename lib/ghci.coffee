{BufferedProcess, Emitter} = require 'atom'
{EOL} = require 'os'
tkill = require 'tree-kill'

module.exports =
class GHCI
  constructor: (opts = {}) ->
    {cwd, atomPath, command, args, component} = opts
    {onResponse, onError, onFinished, onExit} = opts
    @errorBuffer = []
    @responseBuffer = []

    if component?
      args.push component

    @history =
      back: []
      curr: ''
      item: 0

    @emitter = new Emitter

    @onResponse onResponse if onResponse?
    @onError onError if onError?
    @onFinished onFinished if onFinished?
    @onExit onExit if onExit?

    handleError = (error) =>
      @emitter.emit 'response', "GHCI crashed" + EOL + "#{error}"
      console.error error
      @ghci = null
      @emitter.emit 'exit', -1

    try
      @process = new BufferedProcess
        command: command
        args: args
        options: {cwd}
        stdout: (output) =>
          lines = output.toString().split(EOL).slice(0, -1) #last line is empty
          lines = lines.map (line) ->
            if line.length > 10000
              line.slice(0, 10000) + '...'
            else
              line
          @responseBuffer.push lines...
          rx = /^#~IDEHASKELLREPL~(.*)~#$/
          rxres = rx.exec @responseBuffer.slice(-1)[0]
          if rxres?
            @responseBuffer =
              if @responseBuffer.slice(-2)[0]
                @responseBuffer.slice(0, -1)
              else
                @responseBuffer.slice(0, -2)
            @finished = true

            if @response
              @responseBuffer = @responseBuffer.map((line) -> "< #{line}")

            # TODO: Show that command finished
            @emitter.emit 'error', @errorBuffer.join(EOL) + EOL
            @errorBuffer = []
            if @started
              @emitter.emit 'response', @responseBuffer.join(EOL) + EOL
            @responseBuffer = []
            @emitter.emit 'finished', rxres[1]
        stderr: (output) =>
          output.split(EOL).forEach (line) ->
            console.warn "ide-haskell-repl: #{line}"
          @errorBuffer.push output.split(EOL).slice(0, -1)...
        exit: (code) =>
          @ghci = null
          if code isnt 0
            @emitter.emit 'error', @errorBuffer.join(EOL) + EOL
          @emitter.emit 'exit', code

      @process.onWillThrowError ({error, handle}) ->
        handle()
        handleError error

      @ghci = @process.process

      @ghci.stdin.write ":set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"#{EOL}"
      @ghci.stdin.write ":set prompt2 \"\"#{EOL}"
      @ghci.stdin.write ":set editor \"#{atomPath}\"#{EOL}"
    catch error
      handleError error

  isActive: ->
    return !!@ghci

  onFinished: (callback) ->
    @emitter.on 'finished', callback

  onResponse: (callback) ->
    @emitter.on 'response', callback

  onError: (callback) ->
    @emitter.on 'error', callback

  onExit: (callback) ->
    @emitter.on 'exit', callback

  load: (uri) ->
    return unless @isActive()
    @ghci.stdin.write ":load \"#{uri}\"#{EOL}"

  interrupt: ->
    if @ghci?
      tkill @ghci.pid, 'SIGINT'
    @finished = true
    @emitter.emit 'response', 'Interrupted' + EOL

  writeLines: (lines) =>
    return unless @isActive()
    @started = true
    if @finished
      if (text = lines.join(EOL)) and \
          @history.back[@history.back.length - 1] isnt text
        @history.back.push text
      @history.curr = ''
      @history.item = @history.back.length
      @finished = false
      @response = (not lines[0].startsWith ':') or lines[0].startsWith ':type'
      @ghci.stdout.pause()
      @ghci.stderr.pause()
      @errorBuffer = []
      @responseBuffer = []
      @ghci.stdin.write ":{#{EOL}"
      lines.forEach (line) =>
        @ghci.stdin.write line + EOL
        @emitter.emit 'response', '> ' + line + EOL
      @ghci.stdin.write ":}#{EOL}"
      @ghci.stdout.resume()
      @ghci.stderr.resume()
      return true
    else
      return false

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
    @ghci.kill()
