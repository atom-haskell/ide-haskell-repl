import {
  Range,
} from 'atom'

import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
} from './ide-haskell-repl-base'
import * as UPI from 'atom-haskell-upi'
import * as AtomTypes from 'atom'

export {IViewState, IContentItem}

export interface ITypeRecord {
  uri: string
  type: string
  span: Range
}

export class IdeHaskellReplBg extends IdeHaskellReplBase {
  private types?: ITypeRecord[]
  constructor (upiPromise: Promise<UPI.IUPIInstance>, state: IViewState) {
    super(upiPromise, state)
  }

  public showTypeAt (uri: string, inrange: AtomTypes.Range) {
    if (!this.types) { return undefined }
    const typeRec = this.types.find((tr) => tr && tr.uri === uri && tr.span.containsRange(inrange))
    if (!typeRec) { return undefined }
    const {span: range, type: text} = typeRec
    const highlighter = 'hint.type.haskell'
    return { range, text: { text, highlighter }}
  }

  public async destroy () {
    return super.destroy()
  }

  public async update () {
    // noop
  }

  protected async onLoad () {
    await this.getAllTypes()
  }

  protected async onInitialLoad () {
    if (!this.ghci) { throw new Error('No GHCI instance!') }
    await this.ghci.writeLines([':set +c'])
    await this.ghciReload()
    return super.onInitialLoad()
  }

  protected async getAllTypes (): Promise<ITypeRecord[]> {
    if (!this.ghci) { throw new Error('No GHCI instance!') }
    const {stdout} = await this.ghci.writeLines([':all-types'])
    this.types = []
    for (const line of stdout) {
      const rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/
      const match = line.match(rx)
      if (!match) {
        continue
      }
      const m = match.slice(1)
      const uri = m[0]
      const type = m[5]
      const [rowstart, colstart, rowend, colend] = m.slice(1).map((i) => parseInt(i, 10) - 1)
      const span = Range.fromObject([[rowstart, colstart], [rowend, colend]])
      this.types.push({uri, type, span})
    }
    return this.types
  }
}
