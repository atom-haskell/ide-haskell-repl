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
  Disposable,
  Point,
  PointCompatible,
} from 'atom'
import { IdeHaskellReplBase } from './ide-haskell-repl-base'
import { IdeHaskellReplBg } from './ide-haskell-repl-bg'

export interface IErrorItem extends IResultItem {
  _time: number
}

export class UPIConsumer {
  private upiRepl: IUPIInstance
  private upiErrors: IUPIInstance
  private messages: IErrorItem[] = []
  private errors: Map<string, IErrorItem[]> = new Map()
  private disposables = new CompositeDisposable()
  private maxMessageTime = 10000
  private bgEditorMap = new Map<string, IdeHaskellReplBg>()

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
    for (const proc of this.bgEditorMap.values()) {
      // tslint:disable-next-line:no-floating-promises
      proc.destroy()
    }
    this.bgEditorMap.clear()
    this.disposables.dispose()
  }

  public async getBuilder() {
    return this.upiRepl.getOthersConfigParam<{
      name: 'cabal' | 'stack' | 'cabal-nix' | 'none'
    }>('ide-haskell-cabal', 'builder')
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
    const buffer = editor.getBuffer() // important to bind before await
    const { cwd, cabal, comp } = await IdeHaskellReplBase.componentFromURI(path)
    const hash = `${cwd.getPath()}::${cabal && cabal.name}::${comp && comp[0]}`
    let bg = this.bgEditorMap.get(hash)
    if (!bg) bg = this.createNewBgRepl(hash, path, buffer)
    return bg.showTypeAt(path, crange)
  }

  private async didSaveBuffer(buffer: TextBuffer) {
    if (
      !atom.config.get('ide-haskell-repl.checkOnSave') &&
      !atom.config.get('ide-haskell-repl.showTypes')
    ) {
      return
    }
    const path = buffer.getPath()
    if (!path) return
    const { cwd, cabal, comp } = await IdeHaskellReplBase.componentFromURI(path)
    const hash = `${cwd.getPath()}::${cabal && cabal.name}::${comp && comp[0]}`
    const bgt = this.bgEditorMap.get(hash)
    if (bgt) {
      // tslint:disable-next-line:no-floating-promises
      bgt.ghciReload()
    } else {
      this.createNewBgRepl(hash, path, buffer)
    }
  }

  private createNewBgRepl(hash: string, path: string, buffer: TextBuffer) {
    const bg = new IdeHaskellReplBg(this, { uri: path })
    this.bgEditorMap.set(hash, bg)
    const disp = new CompositeDisposable()
    disp.add(
      new Disposable(() => {
        this.disposables.delete(disp)
        this.bgEditorMap.delete(hash)
        // tslint:disable-next-line:no-floating-promises
        bg.destroy()
      }),
      buffer.onDidDestroy(() => disp.dispose()),
    )
    this.disposables.add(disp)
    return bg
  }
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
