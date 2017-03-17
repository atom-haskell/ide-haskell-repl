import {
  Range,
} from 'atom'

import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
} from './ide-haskell-repl-base'

export {IViewState, IContentItem, ITypeRecord}

interface ITypeRecord {
  uri: string
  type: string
  span: Range
}

export class IdeHaskellReplBg extends IdeHaskellReplBase {
  private types: ITypeRecord[]
  constructor (upiPromise, state: IViewState) {
    super(upiPromise, state)
  }

  public showTypeAt (uri: string, range: AtomTypes.Range) {
    if (this.types) {
      for (let tr of this.types) {
        if (tr && tr.uri === uri && tr.span.containsRange(range)) {
          return {
            range: tr.span,
            text: {
              text: tr.type,
              highlighter: 'hint.type.haskell',
            },
          }
        }
      }
    }
  }

  public async destroy () {
    super.destroy()
  }

  public async update () {
    // noop
  }

  protected async onLoad () {
    this.getAllTypes ()
  }

  protected async onInitialLoad () {
    await this.ghci.writeLines([':set +c'])
    await this.ghciReload()
    return super.onInitialLoad()
  }

  protected async getAllTypes (): Promise<ITypeRecord[]> {
    let {stdout} = await this.ghci.writeLines([':all-types'])
    return this.types = stdout.map((line) => {
      let rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/
      let match = line.match(rx)
      if (match) {
        let m = match.slice(1)
        let uri = m[0]
        let type = m[5]
        let [rowstart, colstart, rowend, colend] = m.slice(1).map((i) => parseInt(i, 10) - 1)
        return {
          uri,
          type,
          span: Range.fromObject([[rowstart, colstart], [rowend, colend]]),
        }
      }
    })
  }
}
