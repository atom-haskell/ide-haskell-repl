{BufferedProcess, Emitter} = require 'atom'
{EOL} = require 'os'
tkill = require 'tree-kill'

module.exports =
class GHCI
  constructor: ({cwd, atomPath}) ->
    atomPath ?= 'atom'
    cwd ?= atom.project.getDirectories()[0].getPath()
    @errorBuffer = []
    @responseBuffer = []

    @history =
      back: []
      forw: []
      curr: ''

    @emitter = new Emitter
    @process = new BufferedProcess
      command: 'cabal'
      args: ['repl']
      options: {cwd}
      stdout: (output) =>
        lines = output.toString().split(EOL).slice(0,-1) #last line is empty
        lines = lines.map (line) ->
          if line.length > 10000
            line.slice(0,10000) + '...'
          else
            line
        @responseBuffer.push lines...
        rx = /^#~IDEHASKELLREPL~(.*)~#$/
        rxres = rx.exec @responseBuffer.slice(-1)[0]
        if rxres?
          @responseBuffer =
            if @responseBuffer.slice(-2)[0]
              @responseBuffer.slice(0,-1)
            else
              @responseBuffer.slice(0,-2)
          if @timeout?
            clearTimeout @timeout
            @timeout = null
          @finished = true

          if @response
            @responseBuffer = @responseBuffer.map((line)->"< #{line}")

          # TODO: Show that command finished
          @emitter.emit 'error', @errorBuffer.join(EOL)+EOL
          @errorBuffer = []
          if @started
            @emitter.emit 'response', @responseBuffer.join(EOL)+EOL
          @responseBuffer = []
          @emitter.emit 'finished', rxres[1]
      stderr: (output) =>
        @errorBuffer.push output.split(EOL).slice(0,-1)...
      exit: (code) =>
        @emitter.emit 'exit', code

    @ghci = @process.process

    @ghci.stdin.write ":set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"#{EOL}"
    @ghci.stdin.write ":set prompt2 \"\"#{EOL}"
    @ghci.stdin.write ":set editor \"#{atomPath}\"#{EOL}"

  onFinished: (callback) ->
    @emitter.on 'finished', callback

  onResponse: (callback) ->
    @emitter.on 'response', callback

  onError: (callback) ->
    @emitter.on 'error', callback

  onExit: (callback) ->
    @emitter.on 'exit', callback

  load: (uri) ->
    @ghci.stdin.write ":load \"#{uri}\"#{EOL}"

  writeLines: (lines) =>
    @started = true
    return false unless @finished and (not @timeout?)
    @history.back.push @history.forw...
    @history.forw = []
    @history.back.push lines.join(EOL)
    @history.curr = ''
    @timeout = setTimeout (=>
      tkill @ghci.pid, 'SIGINT'
      @finished = true
      @timeout = null
      ), 1000
    @finished = false
    @response = (not lines[0].startsWith ':') or lines[0].startsWith ':type'
    @ghci.stdout.pause()
    @ghci.stderr.pause()
    @errorBuffer = []
    @responseBuffer = []
    @ghci.stdin.write ":{#{EOL}"
    lines.forEach (line) =>
      @ghci.stdin.write line+EOL
      @emitter.emit 'response', '> '+line+EOL
    @ghci.stdin.write ":}#{EOL}"
    @ghci.stdout.resume()
    @ghci.stderr.resume()
    return true

  historyBack: (current) ->
    if @history.forw.length is 0
      @history.curr = current
    h = @history.back.pop()
    if h?
      @history.forw.push h
      h
    else
      null

  historyForward: ->
    h = @history.forw.pop()
    if h?
      @history.back.push h
      h
    else
      @history.curr

  # Tear down any state and detach
  destroy: ->
    @ghci.stdin.end()
    @ghci.kill()
