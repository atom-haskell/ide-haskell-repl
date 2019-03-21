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
  span: [[number, number], [number, number]]
}

export class IdeHaskellReplBg extends IdeHaskellReplBase {
  private types: Array<ITypeRecord | undefined> = []
  private gotTypes: Promise<void>
  constructor(consumer: UPIConsumer, state: IViewState) {
    super(Promise.resolve(consumer), state, `bg:${state.uri}`)
    this.gotTypes = this.readyPromise
  }

  public async showTypeAt(uri: string, inrange: Range) {
    await this.gotTypes
    const typeRec = this.types.find(
      (tr) =>
        tr !== undefined &&
        tr.uri === uri &&
        Range.fromObject(tr.span).containsRange(inrange),
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
    await this.ghciReload() // required to collect types
    await super.onInitialLoad()
  }

  protected async onReload() {
    await (this.gotTypes = this.getAllTypes())
    await super.onReload()
  }

  protected async getAllTypes(): Promise<void> {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    // don't waste time if don't need to
    if (!atom.config.get('ide-haskell-repl.showTypes')) return
    const { stdout } = await this.ghci.writeLines([':all-types'])
    const cwd = this.cwd
      ? this.cwd
      : await IdeHaskellReplBase.getRootDir(this.uri)
    const rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/
    this.types = stdout.map((line) => {
      const match = line.match(rx)
      if (!match) return undefined
      return {
        uri: path.isAbsolute(match[1])
          ? match[1]
          : cwd.getFile(match[1]).getPath(),
        type: match[6],
        span: [
          [parseInt(match[2], 10) - 1, parseInt(match[3], 10) - 1],
          [parseInt(match[4], 10) - 1, parseInt(match[5], 10) - 1],
        ],
      } as ITypeRecord
    })
  }
}
