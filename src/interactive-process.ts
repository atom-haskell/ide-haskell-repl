'use babel'
import * as CP from 'child_process'

export class InteractiveProcess {
  process: CP.ChildProcess;
  currentRequestPromise: Promise<void>;
  endPattern: RegExp;
  constructor (cmd, args = [], opts : any = {}) {
    this.endPattern = /^#~IDEHASKELLREPL~(.*)~#$/

    opts.stdio = ['pipe', 'pipe', 'pipe']

    this.currentRequestPromise = Promise.resolve()

    const handleError = (error) => {
      this.destroy()
    }

    try {
      this.process = CP.spawn(cmd, args, opts)

      this.process.on('exit', (code) => {
        if (code !== 0) { handleError(new Error('non-zero exit code')) }
        this.destroy()
      })
    } catch (error) {
      handleError(error)
    }
  }

  async request (command: string, lineCallback?: Function, endPattern: RegExp = this.endPattern)
  : Promise<{stdout : string[], stderr: string[]}> {
    await this.currentRequestPromise
    let doResolve
    this.currentRequestPromise = new Promise<void>((resolve) => {doResolve = resolve})

    this.process.stdout.pause()
    this.process.stderr.pause()

    this.writeStdin(command)
    if(lineCallback) lineCallback('stdin', command)

    let res = {
      stdout: [],
      stderr: []
    }

    while(true) {
      let name, line
      [name, line] = await this.readBoth()
      let pattern=line.match(endPattern)
      if(name === 'stdout' && pattern) {
        if(lineCallback) lineCallback('prompt', pattern)
        break;
      }
      if(lineCallback) lineCallback(name, line)
      res[name].push(line)
    }
    this.process.stdout.resume()
    this.process.stderr.resume()

    doResolve()
    console.error(res)
    return res
  }

  writeStdin(str: string) {
    this.process.stdin.write(str)
  }

  readBoth() {
    return Promise.race([
      this.read('stdout', this.process.stdout),
      this.read('stderr', this.process.stderr)
    ])
  }

  async read (name:string, out: NodeJS.ReadableStream) {
    let buffer = ""
    while(!buffer.match(/\n/)) {
      if(!out.readable)
        await new Promise((resolve) => out.once('readable', resolve))
      let read = out.read()
      if(read === null)
        await new Promise((resolve) => out.once('readable', resolve))
      else
        buffer += read
    }
    let [first, ...rest] = buffer.split('\n')
    out.unshift(rest.join('\n'))
    return [name, first]
  }

  destroy () { }

  interrupt () {}
}
