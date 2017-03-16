'use babel'
import * as CP from 'child_process'
import Queue from 'promise-queue'
import tkill from 'tree-kill'

type ExitCallback = (exitCode: number) => void

interface IRequestResult {
  stdout: string[]
  stderr: string[]
}

export class InteractiveProcess {
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
    command: string, lineCallback?: Function, endPattern: RegExp = this.endPattern,
  ): Promise<IRequestResult> {
    return this.requestQueue.add(async () => {
      if (!this.running) {
        throw new Error('Interactive process is not running')
      }

      this.process.stdout.pause()
      this.process.stderr.pause()

      this.writeStdin(command)
      if (lineCallback) {lineCallback('stdin', command)}

      let res = {
        stdout: [],
        stderr: [],
      }

      let ended = false

      setImmediate(async () => {
        while (!ended) {
          let line = await this.read(this.process.stderr)
          if (lineCallback) {lineCallback('stderr', line)}
          res.stderr.push(line)
        }
      })

      while (true) {
        let line
        line = await this.read(this.process.stdout)
        let pattern = line.match(endPattern)
        if (pattern) {
          if (lineCallback) {lineCallback('prompt', pattern)}
          break
        }
        if (lineCallback) {lineCallback('stdout', line)}
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
      let read = out.read()
      if (read === null) {
        await new Promise((resolve) => out.once('readable', () => {
          resolve()
        }))
      } else {
        buffer += read
      }
    }
    let [first, ...rest] = buffer.split('\n')
    out.unshift(rest.join('\n'))
    return first
  }
}
