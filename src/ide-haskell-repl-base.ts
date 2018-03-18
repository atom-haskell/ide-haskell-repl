import * as Util from 'atom-haskell-utils'
import { filter } from 'fuzzaldrin'

import { CommandHistory } from './command-history'
import { GHCI, IRequestResult } from './ghci'
import * as UPI from 'atom-haskell-upi'
import * as AtomTypes from 'atom'
import { UPIConsumer } from './upiConsumer'

export { IRequestResult }

export interface IViewState {
  uri?: string
  history?: string[]
  autoReloadRepeat?: boolean
  content?: IContentItem[]
  focus?: boolean
}

export interface IContentItem {
  text: string
  cls: string
  hl?: boolean
  hlcache?: string
}

export interface IErrorItem extends UPI.IResultItem {
  _time: number
}

export abstract class IdeHaskellReplBase {
  protected ghci?: GHCI
  protected cwd?: AtomTypes.Directory
  protected prompt: string = ''
  protected upi?: UPIConsumer
  protected messages: IContentItem[]
  protected errors: IErrorItem[] = []
  protected _autoReloadRepeat: boolean
  protected history: CommandHistory
  protected uri: string

  constructor(
    upiPromise: Promise<UPIConsumer | undefined>,
    {
      uri,
      content,
      history,
      autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'),
    }: IViewState,
    protected readonly errorSrouce: string,
  ) {
    this.uri = uri || ''
    this.history = new CommandHistory(history)
    this._autoReloadRepeat = !!autoReloadRepeat

    this.messages = content || []

    // tslint:disable-next-line:no-floating-promises
    this.initialize(upiPromise)
  }

  public static async getRootDir(uri: string) {
    return Util.getRootDir(uri)
  }

  public static async getCabalFile(
    rootDir: AtomTypes.Directory,
  ): Promise<AtomTypes.File[]> {
    const cont = await new Promise<Array<AtomTypes.Directory | AtomTypes.File>>(
      (resolve, reject) =>
        rootDir.getEntries((error, contents) => {
          if (error) {
            reject(error)
          } else {
            resolve(contents)
          }
        }),
    )
    return cont.filter(
      (file) => file.isFile() && file.getBaseName().endsWith('.cabal'),
    ) as AtomTypes.File[]
  }

  public static async parseCabalFile(
    cabalFile: AtomTypes.File,
  ): Promise<Util.IDotCabal | null> {
    const cabalContents = await cabalFile.read()
    // tslint:disable-next-line:no-null-keyword
    if (cabalContents === null) return null
    return Util.parseDotCabal(cabalContents)
  }

  public static async getComponent(
    cabalFile: AtomTypes.File,
    uri: string,
  ): Promise<string[]> {
    const cabalContents = await cabalFile.read()
    if (cabalContents === null) return []
    const cwd = cabalFile.getParent()
    return Util.getComponentFromFile(cabalContents, cwd.relativize(uri))
  }

  public static async componentFromURI(uri: string) {
    const cwd = await IdeHaskellReplBase.getRootDir(uri)
    const [cabalFile] = await IdeHaskellReplBase.getCabalFile(cwd)

    let comp: string | undefined
    let cabal: Util.IDotCabal | undefined
    if (cabalFile) {
      cabal = (await IdeHaskellReplBase.parseCabalFile(cabalFile)) || undefined
      ;[comp] = await IdeHaskellReplBase.getComponent(
        cabalFile,
        cwd.relativize(uri),
      )
    }
    return { cwd, comp, cabal }
  }

  public abstract async update(): Promise<void>

  public toggleAutoReloadRepeat() {
    this.autoReloadRepeat = !this.autoReloadRepeat
  }

  public async runCommand(command: string) {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    const inp = command.split('\n')
    const res = await this.ghci.writeLines(inp, (lineInfo) => {
      switch (lineInfo.type) {
        case 'stdin':
          lineInfo.line &&
            this.messages.push({
              text: inp.join('\n'),
              hl: true,
              cls: 'ide-haskell-repl-input-text',
            })
          break
        case 'stdout':
          lineInfo.line &&
            this.messages.push({
              text: lineInfo.line,
              hl: true,
              cls: 'ide-haskell-repl-output-text',
            })
          break
        case 'prompt':
          this.prompt = lineInfo.prompt[1]
          break
        default:
          break
      }
      // tslint:disable-next-line:no-floating-promises
      this.update()
    })
    // tslint:disable-next-line:no-floating-promises
    this.update()
    this.errorsFromStderr(res.stderr)
    return res
  }

  public async ghciReload() {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    const { prompt, stderr } = await this.ghci.reload()
    this.prompt = prompt[1]
    // tslint:disable-next-line:no-floating-promises
    this.update()
    await this.onReload()
    return !this.errorsFromStderr(stderr)
  }

  public async ghciReloadRepeat() {
    if (await this.ghciReload()) {
      const command = this.history.peek(-1)
      if (command) {
        return this.runCommand(command)
      }
    }
    return undefined
  }

  public set autoReloadRepeat(autoReloadRepeat: boolean) {
    this._autoReloadRepeat = autoReloadRepeat
    // tslint:disable-next-line:no-floating-promises
    this.update()
  }

  public get autoReloadRepeat() {
    return this._autoReloadRepeat
  }

  public interrupt() {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    // tslint:disable-next-line:no-floating-promises
    this.ghci.interrupt()
  }

  public async getCompletions(prefix: string) {
    if (!prefix.trim()) {
      return []
    }
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    const res = await this.ghci.sendCompletionRequest()
    if (!res) return undefined
    res.stdout.shift()
    return filter(res.stdout, prefix).map((text) => ({
      text: text.slice(1, -1),
    }))
  }

  public clearErrors() {
    this.setErrors([])
  }

  protected async onInitialLoad() {
    return this.onLoad()
  }

  protected async onReload() {
    return this.onLoad()
  }

  protected async onLoad() {
    return this.clearErrors()
  }

  protected async destroy() {
    this.clearErrors()
    if (this.ghci) {
      this.ghci.destroy()
    }
  }

  protected async initialize(upiPromise: Promise<UPIConsumer | undefined>) {
    this.upi = await upiPromise
    if (!this.upi) {
      return this.runREPL()
    }

    try {
      const builder = await this.upi.getBuilder()
      return await this.runREPL(builder && builder.name)
    } catch (e) {
      const error = e as Error
      if (error) {
        atom.notifications.addFatalError(error.toString(), {
          detail: error.toString(),
          dismissable: true,
          stack: error.stack,
        })
      }
      atom.notifications.addWarning(
        "ide-haskell-repl: Couldn't get builder. Falling back to default REPL",
        {
          dismissable: true,
        },
      )
      return this.runREPL()
    }
  }

  protected async runREPL(
    inbuilder?: 'cabal' | 'stack' | 'cabal-nix' | 'none',
  ) {
    const builder = inbuilder || atom.config.get('ide-haskell-repl.defaultRepl')
    if (!builder) throw new Error(`Default REPL not specified`)

    const { cwd, comp, cabal } = await IdeHaskellReplBase.componentFromURI(
      this.uri,
    )
    this.cwd = cwd

    let commandPath: string
    let commandArgs: string[]
    let extraArgs: (x: string) => string
    switch (builder) {
      case 'cabal':
        commandPath = atom.config.get('ide-haskell-repl.cabalPath')
        commandArgs = ['repl']
        extraArgs = (x: string) => `--ghc-option=${x}`
        break
      case 'cabal-nix':
      case 'cabal-new':
        commandPath = atom.config.get('ide-haskell-repl.cabalPath')
        commandArgs = ['new-repl']
        extraArgs = (x: string) => `--ghc-option=${x}`
        break
      case 'stack':
        commandPath = atom.config.get('ide-haskell-repl.stackPath')
        commandArgs = ['ghci']
        extraArgs = (x: string) => `--ghci-options="${x}"`
        break
      case 'ghci':
      case 'none':
        commandPath = atom.config.get('ide-haskell-repl.ghciPath')
        commandArgs = []
        extraArgs = (x) => x
        break
      default:
        throw new Error(`Unknown builder ${builder}`)
    }

    const extraArgsList = atom.config.get('ide-haskell-repl.extraArgs') || []
    commandArgs.push(...extraArgsList.map(extraArgs))

    if (comp && cabal) {
      if (builder === 'stack') {
        const compc = comp.startsWith('lib:') ? 'lib' : comp
        commandArgs.push(`${cabal.name}:${compc}`)
      } else {
        commandArgs.push(comp)
      }
    }

    this.ghci = new GHCI({
      atomPath: process.execPath,
      command: commandPath,
      args: commandArgs,
      cwd: this.cwd.getPath(),
      onExit: async () => this.destroy(),
    })

    const initres = await this.ghci.waitReady()
    this.prompt = initres.prompt[1]
    await this.onInitialLoad()
    this.errorsFromStderr(initres.stderr)
    return this.update()
  }

  protected errorsFromStderr(stderr: string[]): boolean {
    const errors = this.errors
    let hasErrors = false
    let newMessages = false
    let newErrors = false
    for (const err of stderr
      .filter((x) => !/^\s*\d* \|/.test(x))
      .join('\n')
      .split(/\n(?=\S)/)) {
      if (err) {
        const error = this.parseMessage(err)
        if (error) {
          errors.push(error)
          if (error.severity === 'error') hasErrors = true

          if (error.severity === 'repl') newMessages = true
          else newErrors = true
        }
      }
    }
    // tslint:disable-next-line:no-floating-promises
    this.setErrors(errors, newErrors, newMessages)
    return hasErrors
  }

  protected unindentMessage(message: string): string {
    let lines = message.split('\n').filter((x) => !x.match(/^\s*$/))
    let minIndent: number | undefined
    for (const line of lines) {
      const match = line.match(/^\s*/)
      if (match) {
        const lineIndent = match[0].length
        if (!minIndent || lineIndent < minIndent) {
          minIndent = lineIndent
        }
      }
    }
    if (minIndent !== undefined) {
      const mi = minIndent
      lines = lines.map((line) => line.slice(mi))
    }
    return lines.join('\n')
  }

  protected parseMessage(raw: string): IErrorItem | undefined {
    if (!this.cwd) {
      return undefined
    }
    const matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?[ \t]*(\[[^\]]+\])?[ \t]*\n?([^]*)/
    if (raw && raw.trim() !== '') {
      const matched = raw.match(matchLoc)
      if (matched) {
        const [filec, line, col, rawTyp, context, msg]: Array<
          string | undefined
        > = matched.slice(1)
        let typ: UPI.TSeverity = rawTyp ? rawTyp.toLowerCase() : 'error'
        let file: string | undefined
        if (filec === '<interactive>') {
          file = undefined
          typ = 'repl'
        } else {
          file = filec
        }

        return {
          uri: file
            ? this.cwd.getFile(this.cwd.relativize(file)).getPath()
            : undefined,
          position: [
            parseInt(line as string, 10) - 1,
            parseInt(col as string, 10) - 1,
          ],
          message: {
            text: this.unindentMessage(
              (msg as string & { trimRight(): string }).trimRight(),
            ),
            highlighter: 'hint.message.haskell',
          },
          context,
          severity: typ,
          _time: Date.now(),
        }
      } else {
        return {
          message: raw,
          severity: 'repl',
          _time: Date.now(),
        }
      }
    } else {
      return undefined
    }
  }

  private setErrors(
    errors: IErrorItem[],
    newErrors = true,
    newMessages = true,
  ) {
    this.errors = errors
    if (this.upi) {
      if (newMessages) {
        this.upi.setMessages(
          this.errors.filter(({ severity }) => severity === 'repl'),
        )
      }
      if (newErrors) {
        this.upi.setErrors(
          this.errorSrouce,
          this.errors.filter(({ severity }) => severity !== 'repl'),
        )
      }
    } else {
      // tslint:disable-next-line:no-floating-promises
      this.update()
    }
  }
}
