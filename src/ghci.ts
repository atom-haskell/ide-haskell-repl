import {hsEscapeString} from 'atom-haskell-utils'
import {EOL} from 'os'
import {InteractiveProcess, IRequestResult, TLineCallback} from './interactive-process'

export {TLineCallback, IRequestResult}

export interface IOpts {
  cwd: string
  atomPath: string
  command: string
  args: string[]
  onExit: (code: number) => void
}

export class GHCI {
  // tslint:disable-next-line:no-uninitialized-class-properties
  private process: InteractiveProcess
  private readyPromise: Promise<IRequestResult>
  private onDidExit: (code: number) => void
  constructor (opts: IOpts) {
    const endPattern = /^#~IDEHASKELLREPL~(.*)~#$/
    const { cwd, atomPath, command, args, onExit } = opts
    this.onDidExit = onExit

    if (process.platform === 'win32') {
      const spawnArgs = [command, ...args]
      const cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath')
      if (cmdexe) {
        spawnArgs.unshift('\"' + cmdexe + '\"')
      }
      this.process = new InteractiveProcess(
        'chcp 65001 && ',
        spawnArgs,
        this.didExit.bind(this),
        { cwd, shell: true },
        endPattern,
      )
    } else {
      this.process = new InteractiveProcess(
        command,
        args,
        this.didExit.bind(this),
        { cwd },
        endPattern,
      )
    }

    let resolveReadyPromise
    this.readyPromise = new Promise<IRequestResult>((resolve) => { resolveReadyPromise = resolve })

    this.process.request(
      `:set editor \"${atomPath}\"${EOL}` +
      `:set prompt2 \"\"${EOL}` +
      `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${EOL}`,
    )
    .then(resolveReadyPromise)
  }

  public async waitReady () {
    return await this.readyPromise
  }

  public async load (uri: string, callback?: TLineCallback) {
    return this.process.request(`:load ${hsEscapeString(uri)}${EOL}`, callback)
  }

  public async reload (callback?: TLineCallback) {
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

  public async writeLines (lines: string[], callback?: TLineCallback) {
    return this.process.request(
      `:{${EOL}${lines.join(EOL)}${EOL}:}${EOL}`,
      callback,
    )
  }

  public async sendCompletionRequest (callback?: TLineCallback) {
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
