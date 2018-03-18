import { Range } from 'atom'
import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
} from './ide-haskell-repl-base'
import * as path from 'path'
import { UPIConsumer } from './upiConsumer'

export { IViewState, IContentItem }

export interface ITypeRecord {
  uri: string
  type: string
  span: Range
}

export class IdeHaskellReplBg extends IdeHaskellReplBase {
  private types: ITypeRecord[] = []
  private gotTypes: Promise<void>
  constructor(consumer: UPIConsumer, state: IViewState) {
    super(Promise.resolve(consumer), state, `bg:${state.uri}`)
    this.gotTypes = this.readyPromise
  }

  public async showTypeAt(uri: string, inrange: Range) {
    await this.gotTypes
    if (this.types.length === 0) {
      await (this.gotTypes = this.getAllTypes())
    }
    const typeRec = this.types.find(
      (tr) => tr && tr.uri === uri && tr.span.containsRange(inrange),
    )
    if (!typeRec) {
      return undefined
    }
    const { span: range, type: text } = typeRec
    const highlighter = 'hint.type.haskell'
    return { range, text: { text, highlighter } }
  }

  public async destroy() {
    this.types = []
    return super.destroy()
  }

  public async update() {
    // noop
  }

  protected async onInitialLoad() {
    await super.onInitialLoad()
    await this.ghciReload()
  }

  protected async onLoad() {
    await super.onLoad()
    await (this.gotTypes = this.getAllTypes())
  }

  protected async getAllTypes(): Promise<void> {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    const { stdout } = await this.ghci.writeLines([':all-types'])
    const cwd = this.cwd
      ? this.cwd
      : await IdeHaskellReplBase.getRootDir(this.uri)
    // NOTE: do not await between setting types to [] and returning to avoid duplicate calls
    this.types = []
    for (const line of stdout) {
      const rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/
      const match = line.match(rx)
      if (!match) {
        continue
      }
      const m = match.slice(1)
      let uri = m[0]
      if (!path.isAbsolute(uri)) uri = cwd.getFile(uri).getPath()
      const type = m[5]
      const [rowstart, colstart, rowend, colend] = m
        .slice(1)
        .map((i) => parseInt(i, 10) - 1)
      const span = Range.fromObject([[rowstart, colstart], [rowend, colend]])
      this.types.push({ uri, type, span })
    }
  }
}
