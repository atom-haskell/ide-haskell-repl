import * as CP from 'child_process'
import Queue = require('promise-queue')
import tkill = require('tree-kill')
import EventEmitter = require('events')
import { EOL } from 'os'

if (!Symbol.asyncIterator) {
  Object.defineProperty(Symbol, 'asyncIterator', {
    value: Symbol.for('Symbol.asyncIterator'),
  })
}

export type ExitCallback = (exitCode: number | null) => void

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

function debug(...args: string[]) {
  if (window['atom-haskell-interactive-process-debug'] === true) {
    console.debug(...args)
  }
}

export class InteractiveProcess {
  private process?: CP.ChildProcess
  private requestQueue: Queue
  private endPattern: RegExp
  private events = new EventEmitter()
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
        if (code !== 0) {
          console.error('Process exited abnormally', code)
        }
        this.process = undefined
        onDidExit(code)
        this.destroy()
      })
      this.process.on('error', (err) => {
        atom.notifications.addError(`Process "${cmd}" failed to start`, {
          dismissable: true,
          detail: err.toString(),
          stack: (err as Error).stack,
        })
        this.process = undefined
        onDidExit(-1)
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

      const isEnded = () => res.prompt.length > 0 || this.process === undefined

      const stdErrLine = (line: string) => {
        if (lineCallback) {
          lineCallback({ type: 'stderr', line })
        }
        res.stderr.push(line)
      }

      const stderr = this.process.stderr
      setImmediate(async () => {
        for await (const line of this.readgen(stderr, isEnded)) {
          debug('stderr', line)
          stdErrLine(line)
        }
      })
      try {
        for await (const line of this.readgen(this.process.stdout, isEnded)) {
          debug('stdout', line)
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
      } catch (e) {
        console.error(e, res)
        atom.notifications.addError(`Process crashed while running request`, {
          detail: `\
stderr:
${res.stderr.join('\n')}
stdout:
${res.stdout.join('\n')}
request:
${command}
`,
          dismissable: true,
          stack: (e as Error).stack,
        })
        throw e
      }
    })
  }

  public destroy() {
    if (this.process) {
      tkill(this.process.pid, 'SIGTERM')
      this.process = undefined
    }
    this.events.emit('destroyed')
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
    debug('request', str)
    this.process.stdin.write(str)
  }

  private async waitReadable(stream: NodeJS.ReadableStream) {
    return new Promise((resolve, reject) => {
      if (!this.process) return reject(new Error('No process'))
      const removeListeners = () => {
        this.events.removeListener('destroyed', rejectError)
        stream.removeListener('readable', resolv)
      }
      const rejectError = () => {
        removeListeners()
        reject(new Error('Process destroyed while awaiting stream readable'))
      }
      const resolv = () => {
        removeListeners()
        resolve()
      }
      this.events.once('destroyed', rejectError)
      stream.once('readable', resolv)
    })
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
