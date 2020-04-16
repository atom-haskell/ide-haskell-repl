import {
  IUPIInstance,
  IResultItem,
  IUPIRegistration,
  IMessageText,
  IMessageHTML,
} from 'atom-haskell-upi'
import {
  CompositeDisposable,
  TextEditor,
  Range,
  TextBuffer,
  Point,
  PointCompatible,
} from 'atom'
import { IdeHaskellReplBase } from './ide-haskell-repl-base'
import { IdeHaskellReplBg } from './ide-haskell-repl-bg'

export interface IErrorItem extends IResultItem {
  _time: number
}

export interface BgRec {
  references: number
  bg: IdeHaskellReplBg
  buffers: WeakSet<TextBuffer>
  disposables: CompositeDisposable
  dispose(): void
}

export class UPIConsumer {
  private upiRepl: IUPIInstance
  private upiErrors: IUPIInstance
  private messages: IErrorItem[] = []
  private errors: Map<string, IErrorItem[]> = new Map()
  private disposables = new CompositeDisposable()
  private maxMessageTime = 10000
  private bgEditorMap = new Map<string, BgRec>()

  constructor(register: IUPIRegistration) {
    this.disposables.add(
      (this.upiRepl = register({
        name: 'ide-haskell-repl',
        messageTypes: {
          repl: {
            uriFilter: false,
            autoScroll: true,
          },
        },
        tooltip: this.shouldShowTooltip.bind(this),
        events: {
          onDidSaveBuffer: this.didSaveBuffer.bind(this),
        },
      })),
      (this.upiErrors = register({
        name: 'ide-haskell-repl::errors',
      })),
    )
  }

  public dispose() {
    this.disposables.dispose()
  }

  public async getBuilder(): Promise<
    | {
        name: 'cabal-v1' | 'stack' | 'cabal-v2' | 'none'
      }
    | undefined
  > {
    const builder = await this.upiRepl.getOthersConfigParam<{
      name: 'cabal-v1' | 'stack' | 'cabal-v2' | 'none'
    }>('ide-haskell-cabal', 'builder')
    // backwards compatibility
    switch (builder && (builder.name as string)) {
      case 'cabal':
        // tslint:disable-next-line: no-non-null-assertion
        builder!.name = 'cabal-v1' as const
        break
      case 'cabal-nix':
        // tslint:disable-next-line: no-non-null-assertion
        builder!.name = 'cabal-v2' as const
        break
    }
    return builder
  }

  public setErrors(source: string, errors: IResultItem[]) {
    this.errors.set(source, this.convert(errors))
    this.sendAllErrors()
  }

  public setMessages(messages: IResultItem[]) {
    const all = this.convert(messages)
    this.messages = this.messages.filter(
      ({ _time }) => Date.now() - _time < this.maxMessageTime,
    )
    this.messages.push(...all.filter(({ severity }) => severity === 'repl'))
    this.upiRepl.setMessages(this.messages)
  }

  private convert(xs: IResultItem[]): IErrorItem[] {
    const _time = Date.now()
    return xs.map((x) => ({ ...x, _time }))
  }

  private sendAllErrors() {
    let errors: IErrorItem[] = []
    for (const [source, errorArr] of this.errors.entries()) {
      if (
        !atom.config.get('ide-haskell-repl.checkOnSave') &&
        source.startsWith('bg:')
      ) {
        continue
      }
      errors = errors.filter(
        (x) =>
          !errorArr.some(
            (y) =>
              x._time <= y._time &&
              x.context === y.context &&
              compareMessage(x.message, y.message) &&
              comparePosition(x.position, y.position) &&
              x.severity === y.severity,
          ),
      )
      errors.push(...errorArr)
    }
    this.upiErrors.setMessages(errors)
  }

  private async shouldShowTooltip(
    editor: TextEditor,
    crange: Range,
    _type: string,
  ) {
    if (!atom.config.get('ide-haskell-repl.showTypes')) {
      return undefined
    }
    const path = editor.getPath()
    if (!path) return undefined
    const buffer = editor.getBuffer()
    const { bg } = await this.getBgRepl(buffer)
    if (!bg) return undefined
    return bg.showTypeAt(path, crange)
  }

  private async didSaveBuffer(buffer: TextBuffer) {
    if (
      !atom.config.get('ide-haskell-repl.checkOnSave') &&
      !atom.config.get('ide-haskell-repl.showTypes')
    ) {
      return
    }
    const { bg, isNew } = await this.getBgRepl(buffer)
    if (bg) {
      // no need to reload newly created instance since it reloads on start
      if (isNew) await bg.readyPromise
      else await bg.ghciReload()
    }
  }

  private async getBgRepl(buffer: TextBuffer) {
    const path = buffer.getPath()
    if (!path) return { bg: undefined, isNew: false }
    const { cwd, cabal, comp } = await IdeHaskellReplBase.componentFromURI(path)
    const hash = `${cwd.getPath()}::${cabal && cabal.name}::${comp && comp[0]}`
    let bgrec = this.bgEditorMap.get(hash)
    let isNew = false
    if (!bgrec) {
      bgrec = this.createNewBgRepl(hash, path)
      isNew = true
    }
    subscribeToBuffer(bgrec, buffer)
    return { bg: bgrec.bg, isNew }
  }

  private createNewBgRepl(hash: string, path: string) {
    const bg = new IdeHaskellReplBg(this, { uri: path })
    const bgrec: BgRec = {
      bg,
      references: 0,
      buffers: new WeakSet(),
      disposables: new CompositeDisposable(),
      dispose: () => {
        this.disposables.delete(bgrec)
        this.bgEditorMap.delete(hash)
        // tslint:disable-next-line:no-floating-promises
        bgrec.bg.destroy()
        bgrec.disposables.dispose()
      },
    }
    this.disposables.add(bgrec)
    this.bgEditorMap.set(hash, bgrec)
    bgrec.disposables.add(
      bg.onDidDestroy(() => {
        bgrec.dispose()
      }),
    )
    return bgrec
  }
}

function subscribeToBuffer(rec: BgRec, buffer: TextBuffer) {
  if (rec.buffers.has(buffer)) return
  rec.references++
  rec.buffers.add(buffer)
  rec.disposables.add(
    buffer.onDidDestroy(() => {
      rec.buffers.delete(buffer)
      rec.references--
      if (rec.references === 0) {
        rec.dispose()
      }
    }),
  )
}

function comparePosition(x?: PointCompatible, y?: PointCompatible): boolean {
  if (x && y) {
    return Point.fromObject(x).isEqual(y)
  } else {
    return x === y
  }
}

function compareMessage(
  x: IErrorItem['message'],
  y: IErrorItem['message'],
): boolean {
  if (typeof x === 'string' && typeof y === 'string') {
    return x === y
  } else if (isTextMessage(x) && isTextMessage(y)) {
    return x.text === y.text
  } else if (isHTMLMessage(x) && isHTMLMessage(y)) {
    return x.html === y.html
  }
  return false
}

function isTextMessage(x: IErrorItem['message']): x is IMessageText {
  return (x as any).text !== undefined
}

function isHTMLMessage(x: IErrorItem['message']): x is IMessageHTML {
  return (x as any).text !== undefined
}
