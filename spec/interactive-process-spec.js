'use babel'
import {InteractiveProcess} from '../lib/interactive-process'

describe('InteractiveProcess', () => {
  it('works', () => {
    ip = new InteractiveProcess('cat')
    let i = 1
    let done = false
    ip.request(function * () {
      let {line, type} = yield 'Hello\n'
      expect(line).toBe('Hello')
      expect(type).toBe('stdout')
      i = line
      done = true
    })
    waitsFor(() => done)
    runs(() => {
      expect(i).toBe('Hello')
      expect(ip.currentConsumer).toBe(null)
    })
  })
})
