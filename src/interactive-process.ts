import * as CP from 'child_process'
import Queue = require('promise-queue')
import tkill = require('tree-kill')
import { EOL } from 'os'

if (!Symbol.asyncIterator) {
  Object.defineProperty(Symbol, 'asyncIterator', {
    value: Symbol.for('Symbol.asyncIterator'),
  })
}

export type ExitCallback = (exitCode: number) => void

export interface IRequestResult {
  stdout: string[]
  stderr: string[]
  prompt: RegExpMatchArray
}
export interface ILineIO {
  type: 'stdin' | 'stdout' | 'stderr'
  line: string
}
export interface ILinePrompt {
  type: 'prompt'
  prompt: RegExpMatchArray
}
export type TLineType = ILineIO | ILinePrompt
export type TLineCallback = (line: TLineType) => void

export class InteractiveProcess {
  private process?: CP.ChildProcess
  private requestQueue: Queue
  private endPattern: RegExp
  constructor(
    cmd: string,
    args: string[],
    onDidExit: ExitCallback,
    opts: CP.SpawnOptions,
    endPattern: RegExp,
  ) {
    this.endPattern = endPattern
    this.requestQueue = new Queue(1, 100)

    opts.stdio = ['pipe', 'pipe', 'pipe']

    try {
      this.process = CP.spawn(cmd, args, opts)
      this.process.stdout.setMaxListeners(100)
      this.process.stderr.setMaxListeners(100)
      this.process.stdout.setEncoding('utf-8')
      this.process.stderr.setEncoding('utf-8')

      this.process.on('exit', (code) => {
        onDidExit(code)
        this.process = undefined
        this.destroy()
      })
    } catch (error) {
      atom.notifications.addFatalError('Error spawning REPL', {
        dismissable: true,
        stack: error.stack,
        detail: `Tried to run "${cmd}" with arguments: ${args}`,
      })
      this.destroy()
    }
  }

  public async request(
    command: string,
    lineCallback?: TLineCallback,
    endPattern: RegExp = this.endPattern,
  ): Promise<IRequestResult> {
    return this.requestQueue.add(async () => {
      if (!this.process) {
        throw new Error('Interactive process is not running')
      }

      this.process.stdout.pause()
      this.process.stderr.pause()

      this.writeStdin(command)
      if (lineCallback) {
        lineCallback({ type: 'stdin', line: command })
      }

      const res: IRequestResult = {
        stdout: [],
        stderr: [],
        prompt: [],
      }

      const isEnded = () => res.prompt.length > 0

      const stdErrLine = (line: string) => {
        if (lineCallback) {
          lineCallback({ type: 'stderr', line })
        }
        res.stderr.push(line)
      }

      const stderr = this.process.stderr
      setImmediate(async () => {
        for await (const line of this.readgen(stderr, isEnded)) {
          stdErrLine(line)
        }
      })

      for await (const line of this.readgen(this.process.stdout, isEnded)) {
        const pattern = line.match(endPattern)
        if (pattern) {
          if (lineCallback) {
            lineCallback({ type: 'prompt', prompt: pattern })
          }
          res.prompt = pattern
        } else {
          if (lineCallback) {
            lineCallback({ type: 'stdout', line })
          }
          res.stdout.push(line)
        }
      }
      // tslint:disable-next-line:no-unsafe-any
      const restErr: string = this.process.stderr.read()
      if (restErr) {
        restErr.split('\n').forEach(stdErrLine)
      }
      this.process.stdout.resume()
      this.process.stderr.resume()
      return res
    })
  }

  public destroy() {
    if (this.process) {
      tkill(this.process.pid, 'SIGTERM')
      this.process = undefined
    }
  }

  public interrupt() {
    if (this.process) {
      tkill(this.process.pid, 'SIGINT')
    }
  }

  public isBusy() {
    return this.requestQueue.getPendingLength() > 0
  }

  public writeStdin(str: string) {
    if (!this.process) {
      throw new Error('Interactive process is not running')
    }
    this.process.stdin.write(str)
  }

  private async waitReadable(stream: NodeJS.ReadableStream) {
    return new Promise((resolve) =>
      stream.once('readable', () => {
        resolve()
      }),
    )
  }

  private async *readgen(out: NodeJS.ReadableStream, isEnded: () => boolean) {
    let buffer = ''
    while (!isEnded()) {
      const read = out.read()
      // tslint:disable-next-line: no-null-keyword strict-type-predicates
      if (read != null) {
        buffer += read
        if (buffer.match(EOL)) {
          const arr = buffer.split(EOL)
          buffer = arr.pop() || ''
          yield* arr
        }
      } else {
        await this.waitReadable(out)
      }
    }
    if (buffer) {
      out.unshift(buffer)
    }
  }
}
