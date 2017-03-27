import * as CP from 'child_process'
import Queue = require('promise-queue')
import tkill = require('tree-kill')

type ExitCallback = (exitCode: number) => void

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
  // tslint:disable-next-line:no-uninitialized-class-properties
  private process: CP.ChildProcess
  private requestQueue: Queue
  private endPattern: RegExp
  private running: boolean
  constructor (cmd: string, args: string[], onDidExit: ExitCallback, opts: CP.SpawnOptions, endPattern: RegExp) {
    this.endPattern = endPattern
    this.running = false
    this.requestQueue = new Queue(1, 100)

    opts.stdio = ['pipe', 'pipe', 'pipe']

    try {
      this.process = CP.spawn(cmd, args, opts)
      this.process.stdout.setMaxListeners(100)
      this.process.stderr.setMaxListeners(100)
      this.process.stdout.setEncoding('utf-8')
      this.process.stderr.setEncoding('utf-8')
      this.running = true

      this.process.on('exit', (code) => {
        this.running = false
        onDidExit(code)
        this.destroy()
      })
    } catch (error) {
      this.destroy()
    }
  }

  public async request (
    command: string, lineCallback?: TLineCallback, endPattern: RegExp = this.endPattern,
  ): Promise<IRequestResult> {
    return this.requestQueue.add(async () => {
      if (!this.running) {
        throw new Error('Interactive process is not running')
      }

      this.process.stdout.pause()
      this.process.stderr.pause()

      this.writeStdin(command)
      if (lineCallback) {lineCallback({type: 'stdin', line: command})}

      const res: IRequestResult = {
        stdout: [],
        stderr: [],
        prompt: [],
      }

      let ended = false

      setImmediate(async () => {
        while (!ended) {
          const line = await this.read(this.process.stderr)
          if (lineCallback) {lineCallback({type: 'stderr', line})}
          res.stderr.push(line)
        }
      })

      while (true) {
        let line: string
        line = await this.read(this.process.stdout)
        const pattern = line.match(endPattern)
        if (pattern) {
          if (lineCallback) {lineCallback({type: 'prompt', prompt: pattern})}
          res.prompt = pattern
          break
        }
        if (lineCallback) {lineCallback({type: 'stdout', line})}
        res.stdout.push(line)
      }
      ended = true
      this.process.stdout.resume()
      this.process.stderr.resume()

      return res
    })
  }

  public destroy () {
    if (this.running) {
      tkill(this.process.pid, 'SIGTERM')
    }
  }

  public interrupt () {
    tkill(this.process.pid, 'SIGINT')
  }

  private writeStdin (str: string) {
    this.process.stdin.write(str)
  }

  private async read (out: NodeJS.ReadableStream) {
    let buffer = ''
    while (!buffer.match(/\n/)) {
      const read = out.read()
      if (read === null) {
        await new Promise((resolve) => out.once('readable', () => {
          resolve()
        }))
      } else {
        buffer += read
      }
    }
    const [first, ...rest] = buffer.split('\n')
    out.unshift(rest.join('\n'))
    return first
  }
}
