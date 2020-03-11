import { hsEscapeString } from 'atom-haskell-utils'
import { EOL } from 'os'
import {
  InteractiveProcess,
  IRequestResult,
  TLineCallback,
} from './interactive-process'
import Queue = require('promise-queue')

export { TLineCallback, IRequestResult }

export interface IOpts {
  cwd: string
  atomPath: string
  command: string
  args: string[]
  onExit: (code: number | null) => void
}

export class GHCI {
  private process: InteractiveProcess
  private readyPromise: Promise<IRequestResult>
  private onDidExit: (code: number | null) => void
  private commandQueue: Queue = new Queue(1, 100)
  constructor(opts: IOpts) {
    const endPattern = /^#~IDEHASKELLREPL~(.*)~#$/
    const { cwd, atomPath, command, args, onExit } = opts
    this.onDidExit = onExit

    if (process.platform === 'win32') {
      const spawnArgs = [command, ...args]
      const cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath')
      if (cmdexe) {
        spawnArgs.unshift('"' + cmdexe + '"')
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

    this.readyPromise = this.request(
      `:set editor \"${atomPath}\" --wait${EOL}` +
        `:set prompt2 \"\"${EOL}` +
        `:set prompt-cont \"\"${EOL}` +
        `:set +c${EOL}` +
        `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${EOL}`,
    )
  }

  public async waitReady() {
    return this.readyPromise
  }

  public isBusy() {
    return this.commandQueue.getPendingLength() > 0
  }

  public async load(uri: string, callback?: TLineCallback) {
    return this.request(`:load ${hsEscapeString(uri)}${EOL}`, callback)
  }

  public async reload(callback?: TLineCallback) {
    return this.request(`:reload${EOL}`, callback)
  }

  public async interrupt() {
    if (this.process) {
      if (
        atom.config.get('ide-haskell-repl.ghciWrapperPath') &&
        process.platform === 'win32'
      ) {
        this.process.writeStdin('\x03')
      } else {
        this.process.interrupt()
      }
    }
  }

  public async writeLines(lines: string[], callback?: TLineCallback) {
    return this.request(`:{${EOL}${lines.join(EOL)}${EOL}:}${EOL}`, callback)
  }

  public writeRaw(raw: string) {
    this.process.writeStdin(raw)
  }

  public async sendCompletionRequest() {
    if (this.isBusy()) return undefined
    // NOTE: this *has* to go around commandQueue, since completion requests
    // shouldn't affect busy status
    return this.process.request(`:complete repl \"\"${EOL}`)
  }

  public destroy() {
    this.process.destroy()
  }

  private didExit(code: number | null) {
    this.onDidExit(code)
    this.destroy()
  }

  private async request(command: string, lineCallback?: TLineCallback) {
    return this.commandQueue.add(async () =>
      this.process.request(command, lineCallback),
    )
  }
}
