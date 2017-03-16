'use babel'

import {hsEscapeString} from 'atom-haskell-utils'
import {EOL} from 'os'
import { InteractiveProcess } from './interactive-process'

interface IOpts {
  cwd: string
  atomPath: string
  command: string
  args: string[]
  onExit: (code: number) => void
}

export class GHCI {
  private process: InteractiveProcess
  private splitrx: RegExp
  private readyPromise: Promise<void>
  private onDidExit: (code: number) => void
  constructor (opts: IOpts) {
    this.splitrx = /^#~IDEHASKELLREPL~(.*)~#$/
    let { cwd, atomPath, command, args, onExit } = opts
    this.onDidExit = onExit

    if (process.platform === 'win32') {
      let spawnArgs = [command, ...args]
      let cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath')
      if (cmdexe) {
        spawnArgs.unshift('\"' + cmdexe + '\"')
      }
      this.process = new InteractiveProcess(
        'chcp 65001 && ',
        spawnArgs,
        this.didExit.bind(this),
        { cwd, shell: true },
      )
    } else {
      this.process = new InteractiveProcess(
        command,
        args,
        this.didExit.bind(this),
        { cwd },
      )
    }

    let resolveReadyPromise
    this.readyPromise = new Promise<void>((resolve) => { resolveReadyPromise = resolve })

    this.process.request(
      `:set editor \"#{atomPath}\"${EOL}` +
      `:set prompt2 \"\"${EOL}` +
      `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${EOL}`,
    )
    .then(resolveReadyPromise)
  }

  public async waitReady () {
    await this.readyPromise
  }

  public load (uri: string, callback?: Function) {
    return this.process.request(`:load ${hsEscapeString(uri)}${EOL}`, callback)
  }

  public reload (callback?: Function) {
    return this.process.request(`:reload${EOL}`, callback)
  }

  public interrupt () {
    if (this.process) {
      if (atom.config.get('ide-haskell-repl.ghciWrapperPath') && process.platform === 'win32') {
        this.process.request('\x03')
      } else {
        this.process.interrupt()
      }
    }
  }

  public writeLines (lines: string[], callback?: Function) {
    return this.process.request(
      `:{${EOL}${lines.join(EOL)}${EOL}:}${EOL}`,
      callback,
      {
        stderr: /\n\S/,
      },
    )
  }

  public sendCompletionRequest (callback?: Function) {
    return this.process.request(`:complete repl \"\"${EOL}`, callback)
  }

  public destroy () {
    this.process.destroy()
  }

  private didExit (code: number) {
    this.onDidExit(code)
    this.destroy()
  }
}
