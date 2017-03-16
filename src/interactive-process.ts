'use babel'
import * as CP from 'child_process'
import tkill from 'tree-kill'

export class InteractiveProcess {
  private process: CP.ChildProcess
  private currentRequestPromise: Promise<void>
  private resolveCurrentRequestPromise: () => void
  private endPattern: RegExp
  private running: boolean
  constructor (cmd, args = [], opts: any = {}) {
    this.endPattern = /^#~IDEHASKELLREPL~(.*)~#$/
    this.running = false

    opts.stdio = ['pipe', 'pipe', 'pipe']

    this.currentRequestPromise = Promise.resolve()
    this.resolveCurrentRequestPromise = () => null

    try {
      this.process = CP.spawn(cmd, args, opts)
      this.running = true

      this.process.on('exit', (code) => {
        if (code !== 0) {
          // TODO
        }
        this.running = false
        this.destroy()
      })
    } catch (error) {
      this.destroy()
    }
  }

  public async request (
    command: string, lineCallback?: Function, endPattern: RegExp = this.endPattern,
  ): Promise<{stdout: string[], stderr: string[]}> {
    await this.currentRequestPromise
    this.currentRequestPromise = new Promise<void>((resolve) => {this.resolveCurrentRequestPromise = resolve})

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

    while (true) {
      let name, line
      [name, line] = await this.readBoth()
      let pattern = line.match(endPattern)
      if (name === 'stdout' && pattern) {
        if (lineCallback) {lineCallback('prompt', pattern)}
        break
      }
      if (lineCallback) {lineCallback(name, line)}
      res[name].push(line)
    }
    this.process.stdout.resume()
    this.process.stderr.resume()

    this.resolveCurrentRequestPromise()
    console.error(res)
    return res
  }

  public destroy () {
    if (this.running) {
      tkill(this.process.pid, 'SIGTERM')
    }
    this.resolveCurrentRequestPromise()
  }

  public interrupt () {
    tkill(this.process.pid, 'SIGINT')
  }

  private writeStdin (str: string) {
    this.process.stdin.write(str)
  }

  private readBoth () {
    return Promise.race([
      this.read('stdout', this.process.stdout),
      this.read('stderr', this.process.stderr),
    ])
  }

  private async read (name: string, out: NodeJS.ReadableStream) {
    let buffer = ''
    while (!buffer.match(/\n/)) {
      if (!out.readable) {
        await new Promise((resolve) => out.once('readable', resolve))
      }
      let read = out.read()
      if (read === null) {
        await new Promise((resolve) => out.once('readable', resolve))
      } else {
        buffer += read
      }
    }
    let [first, ...rest] = buffer.split('\n')
    out.unshift(rest.join('\n'))
    return [name, first]
  }
}
