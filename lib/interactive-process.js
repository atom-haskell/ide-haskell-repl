'use babel'
import CP from 'child_process'

export class InteractiveProcess {
  constructor (cmd, args = [], opts = {}) {
    this.currentConsumer = null
    this.consumerQueue = []

    opts.stdio = ['pipe', 'pipe', 'pipe']

    const handleError = (error) => {
      if (this.currentConsumer) {
        this.currentConsumer.throw(error)
      }
      for (let consumer of this.consumerQueue) {
        consumer.throw(error)
      }
      this.destroy()
    }

    try {
      this.process = CP.spawn(cmd, args, opts)

      const buffered = function (handleOutput) {
        let buffer = ''
        return function (data) {
          let output = data.toString('utf8')
          let [first, ...rest] = output.split(/\r?\n/)
          buffer += first
          if (rest.length > 0) {
            let lines = rest.slice(0, -1)
            lines.unshift(buffer)
            buffer = rest.slice(-1)
            handleOutput(lines)
          }
        }
      }

      this.process.stdout.on('data', buffered((lines) => {
        console.error(lines)
        this.sendLines(lines, 'stdout')
      }))
      this.process.stderr.on('data', buffered((lines) => {
        this.sendLines(lines, 'stderr')
      }))
      this.process.on('exit', (code) => {
        if (code !== 0) { handleError(new Error(code)) }
        this.destroy()
      })
    } catch (error) {
      handleError(error)
    }
  }

  request (gen) {
    this.consumerQueue.push(gen)
    this.getNext()
  }

  sendLines (lines, type) {
    if (this.currentConsumer) {
      for (let line of lines) {
        let {done} = this.currentConsumer.next({line, type})
        this.handleDone(done)
      }
    }
  }

  getNext () {
    if (this.consumerQueue.length === 0 || this.currentConsumer) return
    let gen = this.consumerQueue.shift()
    this.currentConsumer = gen()
    let {done, value} = this.currentConsumer.next()
    this.process.stdin.write(value)
    this.handleDone(done)
  }

  handleDone (done) {
    if (done) {
      this.currentConsumer = null
      this.getNext()
    }
  }

  destroy () {

  }
}
