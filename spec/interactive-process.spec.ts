import { InteractiveProcess } from '../lib/interactive-process'

import { expect } from 'chai'

describe('InteractiveProcess', () => {
  it('works', async () => {
    const noop = () => undefined
    const ip = new InteractiveProcess('cat', [], noop, {}, /.*$/)
    let i = 1
    await ip.request('Hello\nworld\n', (line) => {
      switch (i) {
        case 1:
          expect(line.type).to.equal('stdin')
          if (line.type === 'stdin') {
            expect(line.line).to.equal('Hello\nworld\n')
          }
          break
        case 2:
          expect(line.type).to.equal('prompt')
          if (line.type === 'prompt') {
            expect(line.prompt[0]).to.equal('Hello')
          }
          break
        case 3:
          expect(line.type).to.equal('prompt')
          if (line.type === 'prompt') {
            expect(line.prompt[0]).to.equal('world')
          }
          break
        default:
          throw new Error(`Unexpected ${i}: ${JSON.stringify(line)}`)
      }
      i++
    })
    ip.destroy()
  })
})
