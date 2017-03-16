import {
  CompositeDisposable,
  TextEditor,
} from 'atom'
import * as Util from 'atom-haskell-utils'
import highlightSync = require('atom-highlight')
import etch = require('etch')
import {filter} from 'fuzzaldrin'

import {Button} from './button'
import {CommandHistory} from './command-history'
import {Editor} from './editor'
import {GHCI} from './ghci'

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

type UPI = any

export interface IViewState {
  uri?: string
  history?: string[]
  autoReloadRepeat?: boolean
  content?: IContentItem[]
}

interface IViewStateOutput extends IViewState {
  deserializer: string
}

export interface IContentItem {
  text: string
  cls: string
  hl?: boolean
}

type Severity = 'error' | 'warning' | 'repl' | string

export interface IErrorItem {
  uri?: string,
  position?: [number, number],
  message: string,
  context?: string,
  severity: Severity,
  _time: number,
}

declare interface IMyString extends String {
  trimRight (): IMyString
}

export class IdeHaskellReplView {
  public refs: {[key: string]: any}
  public editor: TextEditor
  private ghci: GHCI
  private cwd: AtomTypes.Directory
  private prompt: string
  private upi: UPI
  private outputFontFamily: any
  private outputFontSize: any
  private messages: IContentItem[]
  private errors: IErrorItem[]
  private autoReloadRepeat: boolean
  private history: CommandHistory
  private uri: string
  private disposables: CompositeDisposable
  constructor (upiPromise, {
    uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'),
  }: IViewState) {
    this.uri = uri
    this.history = new CommandHistory(history)
    this.setAutoReloadRepeat(autoReloadRepeat)
    this.disposables = new CompositeDisposable()
    this.errors = []

    this.editor = new TextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
      grammar: atom.grammars.grammarForScopeName('source.haskell'),
    })

    atom.textEditors.add(this.editor)

    this.messages = content || []

    this.disposables.add(
      atom.workspace.observeTextEditors((editor) => {
        if (editor.getURI() === this.uri) {
          this.disposables.add(editor.onDidSave(() => {
            if (this.autoReloadRepeat) { this.ghciReloadRepeat() }
          }))
        }
      }),
    )
    this.disposables.add(atom.config.observe('editor.fontSize', (fontSize) => {
      this.outputFontSize = `${fontSize}px`
    }))
    this.disposables.add(atom.config.observe('editor.fontFamily', (fontFamily) => {
      this.outputFontFamily = fontFamily
    }))

    this.cwd = Util.getRootDir(this.uri)

    etch.initialize(this)

    this.initialize(upiPromise)
  }

  public async execCommand () {
    let inp = this.editor.getBuffer().getText()
    this.editor.setText('')
    this.history.save(inp)
    return this.runCommand(inp)
  }

  public copyText (command) {
    this.editor.setText(command)
    this.editor.element.focus()
  }

  public async runCommand (command: string) {
    let inp = command.split('\n')
    let res = await this.ghci.writeLines(inp, (type, text) => {
      console.error(type, text)
      switch (type) {
        case 'stdin':
          text && this.messages.push({text: inp.join('\n'), hl: true, cls: 'ide-haskell-repl-input-text'})
          break
        case 'stdout':
          text && this.messages.push({text, hl: true, cls: 'ide-haskell-repl-output-text'})
          break
        case 'prompt':
          this.prompt = text[1]
          break
        default: break
      }
      this.update()
    })
    this.errorsFromStderr(res.stderr)
    return res
  }

  public historyBack () {
    let current = this.editor.getText()
    this.editor.setText(this.history.goBack(current))
  }

  public historyForward () {
    this.editor.setText(this.history.goForward())
  }

  public async ghciReload () {
    return this.ghci.reload()
  }

  public async ghciReloadRepeat () {
    let {stderr} = await this.ghci.reload()
    if (! this.errorsFromStderr(stderr)) {
      let command = this.history.goBack('')
      return this.runCommand(command)
    }
  }

  public toggleAutoReloadRepeat () {
    this.setAutoReloadRepeat(!this.getAutoReloadRepeat())
  }

  public setAutoReloadRepeat (autoReloadRepeat: boolean) {
    this.autoReloadRepeat = autoReloadRepeat
    this.update()
  }

  public getAutoReloadRepeat () {
    return this.autoReloadRepeat
  }

  public interrupt () {
    this.ghci.interrupt()
  }

  public async getCompletions (prefix) {
    if (!prefix.trim()) {
      return []
    }
    let {stdout} = await this.ghci.sendCompletionRequest()
    stdout.shift()
    return filter(stdout, prefix).map((text) => ({text: text.slice(1, -1)}))
  }

  public getURI () {
    return `ide-haskell://repl/${this.uri}`
  }

  public getTitle () {
    return `REPL: ${this.uri}`
  }

  public async destroy () {
    etch.destroy(this)
    if (this.ghci) {
      this.ghci.destroy()
    }
    this.disposables.dispose()
  }

  public serialize (): IViewStateOutput {
    return {
      deserializer: 'IdeHaskellReplView',
      uri: this.uri,
      content: this.messages,
      history: this.history.serialize(),
      autoReloadRepeat: this.autoReloadRepeat,
    }
  }

  public render () {
    return (
      <div className="ide-haskell-repl">
        <div ref="output" className="ide-haskell-repl-output native-key-bindings" tabIndex="-1"
          style={{fontSize: this.outputFontSize, fontFamily: this.outputFontFamily}}>
          {this.renderOutput()}
        </div>
        {this.renderErrDiv()}
        {this.renderPrompt()}
        <div className="ide-haskell-repl-editor">
          <div className="editor-container">
            <Editor ref="editor" element={this.editor.element}
              />
          </div>
          <Button
            cls="reload-repeat"
            tooltip="Reload file and repeat last command"
            command="ide-haskell-repl:reload-repeat"
            parent={this}/>
          <Button
            cls="auto-reload-repeat"
            tooltip="Toggle reload-repeat on file save"
            command="ide-haskell-repl:toggle-auto-reload-repeat"
            state={this.autoReloadRepeat}
            parent={this}/>
          <Button
            cls="interrupt"
            tooltip="Interrupt current computation"
            command="ide-haskell-repl:ghci-interrupt"
            parent={this}/>
        </div>
      </div>
    )
  }

  private renderErrDiv () {
    if (!this.upi) {
      return (
        <div className="ide-haskell-repl-error">
          {this.errors /*TODO render*/}
        </div>
      )
    } else { return null }
  }

  private renderPrompt () {
    return (
      <div>{this.prompt || ''} &gt;</div>
    )
  }

  private renderOutput () {
    return this.messages.map(({text, cls, hl}: IContentItem) => {
      let cleanText = text.replace(termEscapeRx, '')
      if (hl) {
        return (
          <pre className={cls}
            innerHTML={highlightSync({fileContents: cleanText, scopeName: 'source.haskell', nbsp: false})} >
          </pre>
        )
      } else {
        return <pre className={cls}>{cleanText}</pre>
      }
    })
  }

  private async update () {
    let atEnd = !!this.refs &&
      (this.refs.output.scrollTop + this.refs.output.clientHeight >= this.refs.output.scrollHeight)
    let focused = !!this.refs && !!document.activeElement &&
      (this.refs.editor.element.contains(document.activeElement))
    await etch.update(this)
    if (atEnd) {
      this.refs.output.scrollTop = this.refs.output.scrollHeight - this.refs.output.clientHeight
    }
    if (focused) {
      this.refs.editor.element.focus()
    }
  }

  private async initialize (upiPromise: Promise<UPI>) {
    this.upi = await upiPromise
    if (!this.upi) { return this.runREPL(null) }

    try {
      let builder = await this.upi.params.get('ide-haskell-cabal', 'builder')
      this.runREPL((builder || {}).name)
    } catch (error) {
      if (error) {
        atom.notifications.addFatalError(error.toString(), {
          detail: error,
          dismissable: true,
        })
        this.destroy()
      } else {
        atom.notifications.addWarning("Can't run REPL without knowing what builder to use")
        this.destroy()
      }
    }
  }

  private async runREPL (builder: string) {
    this.editor.element.focus()
    this.disposables.add(atom.workspace.onDidChangeActivePaneItem((item) => {
      if (item === this) { setImmediate(() => { this.editor.element.focus() }) }
    }))

    if (!builder) { builder = atom.config.get('ide-haskell-repl.defaultRepl') }
    let subst = {
      'nix-build': 'cabal',
      'none': 'ghci',
    }
    builder = (subst[builder] || builder)

    let [cabalFile] =
      this.cwd.getEntriesSync().filter((file) =>
        file.isFile() && file.getBaseName().endsWith('.cabal'))

    let cabal, comp
    if (cabalFile) {
      let cabalContents = cabalFile.readSync()
      cabal = Util.parseDotCabalSync(cabalContents)
      [comp] = Util.getComponentFromFileSync(cabalContents, this.cwd.relativize(this.uri))
    }
    let commandPath = atom.config.get(`ide-haskell-repl.${builder}Path`)

    let args = {
      stack: ['ghci'],
      cabal: ['repl'],
      ghci: [],
    }
    let extraArgs = {
      stack: (x) => '--ghci-options="#{x}"',
      cabal: (x) => '--ghc-option=#{x}',
      ghci: (x) => x,
    }

    if (!args[builder]) { throw new Error('Unknown builder #{builder}') }
    let commandArgs = args[builder]

    commandArgs.push(...(atom.config.get('ide-haskell-repl.extraArgs').map(extraArgs[builder])))

    if (comp) {
      if (builder === 'stack') {
        if (comp.startsWith('lib:')) {
          comp = 'lib'
        }
        comp = `${cabal.name}:${comp}`
        commandArgs.push('--main-is', comp)
      } else { commandArgs.push(comp) }
    }

    this.ghci = new GHCI({
      atomPath: process.execPath,
      command: commandPath,
      args: commandArgs,
      cwd: this.cwd.getPath(),
      onExit: async (code) => this.destroy(),
    })

    await this.ghci.waitReady()

    this.ghci.load(this.uri, (type, text) => {
      if (type === 'prompt') {
        this.prompt = text[1]
        this.update()
      }
    })
  }

  private errorsFromStderr (stderr: string[]): boolean {
    this.errors = this.errors.filter(({_time}) => Date.now() - _time < 10000)
    let hasErrors = false
    for (let err of stderr.join('\n').split(/\n(?=\S)/)) {
      if (err) {
        let error = this.parseMessage(err)
        this.errors.push(error)
        if (error.severity === 'error') {
          hasErrors = true
        }
      }
    }
    if (this.upi) {
      this.upi.messages.set(this.errors)
    } else {
      this.update()
    }
    return hasErrors
  }

  private unindentMessage (message): string {
    let lines = message.split('\n').filter((x) => !x.match(/^\s*$/))
    let minIndent = null
    for (let line of lines) {
      let match = line.match(/^\s*/)
      let lineIndent = match[0].length
      if (lineIndent < minIndent || !minIndent) { minIndent = lineIndent }
    }
    console.error(minIndent, lines)
    if (minIndent) {
      lines = lines.map((line) => line.slice(minIndent))
    }
    return lines.join('\n')
  }

  private parseMessage (raw): IErrorItem {
    let matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?\s*(\[[^\]]+\])?/
    if (raw && raw.trim() !== '') {
      let matched = raw.match(matchLoc)
      if (matched) {
        let msg = raw.split('\n').slice(1).join('\n')
        let [file, line, col, rawTyp, context]: String[] = matched.slice(1)
        let typ: Severity = rawTyp ? rawTyp.toLowerCase() : 'error'
        if (file === '<interactive>') {
          file = null
          typ = 'repl'
        }

        // NOTE: this is done because typescript insists strings dont have
        // trimRight() method
        let msgany = msg as IMyString

        return {
          uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : null,
          position: [parseInt(line as string, 10) - 1, parseInt(col as string, 10) - 1],
          message: this.unindentMessage(msgany.trimRight()),
          context: context as string,
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
    }
  }
}