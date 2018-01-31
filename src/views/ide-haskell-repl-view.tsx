import { CompositeDisposable, TextEditor, Point, TWatchEditor } from 'atom'
import highlightSync = require('atom-highlight')
import etch = require('etch')

import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
  IErrorItem,
  IRequestResult,
} from '../ide-haskell-repl-base'
import { Button } from './button'
import { Editor } from './editor'
import * as UPI from 'atom-haskell-upi'

export { IViewState, IContentItem, IRequestResult }

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

export interface IViewStateOutput extends IViewState {
  deserializer: string
}

export interface IProps extends JSX.Props {
  upiPromise: Promise<UPI.IUPIInstance>
  state: IViewState
  watchEditorPromise: Promise<TWatchEditor>
}

// tslint:disable-next-line:no-unsafe-any
export class IdeHaskellReplView extends IdeHaskellReplBase
  implements JSX.ElementClass {
  // tslint:disable-next-line:no-uninitialized
  public refs: {
    output: HTMLElement
    editor: Editor
  }
  public editor: TextEditor
  // tslint:disable-next-line:no-uninitialized
  private outputFontFamily: string
  // tslint:disable-next-line:no-uninitialized
  private outputFontSize: string
  private disposables: CompositeDisposable
  private destroyed: boolean = false
  constructor(public props: IProps) {
    super(props.upiPromise, props.state)
    this.disposables = new CompositeDisposable()

    this.editor = atom.workspace.buildTextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
    })
    const grammar = atom.grammars.grammarForScopeName('source.haskell')
    grammar && this.editor.setGrammar(grammar)

    this.disposables.add(
      atom.workspace.observeTextEditors((editor: TextEditor) => {
        if (editor.getPath() === this.uri) {
          this.disposables.add(
            editor.onDidSave(() => {
              if (this.autoReloadRepeat) {
                // tslint:disable-next-line:no-floating-promises
                this.ghciReloadRepeat()
              }
            }),
          )
        }
      }),
    )
    this.disposables.add(
      atom.config.observe('editor.fontSize', (fontSize: number) => {
        this.outputFontSize = `${fontSize}px`
      }),
    )
    this.disposables.add(
      atom.config.observe('editor.fontFamily', (fontFamily: string) => {
        this.outputFontFamily = fontFamily
      }),
    )

    etch.initialize(this)

    if (this.props.state.focus) setImmediate(() => this.focus())
    this.registerEditor().catch((e: Error) => {
      atom.notifications.addError(e.toString(), {
        detail: e.stack,
        dismissable: true,
      })
    })
  }

  public focus = () => {
    this.refs && this.refs.editor && this.refs.editor.element.focus()
  }

  public async execCommand() {
    const inp = this.editor.getBuffer().getText()
    this.editor.setText('')
    if (this.ghci && this.ghci.isBusy()) {
      this.messages.push({
        text: inp,
        hl: false,
        cls: 'ide-haskell-repl-input-text',
      })
      this.ghci.writeRaw(inp)
      return undefined
    } else {
      this.history.save(inp)
      return this.runCommand(inp)
    }
  }

  public copyText(command: string) {
    this.editor.setText(command)
    atom.views.getView(this.editor).focus()
  }

  public historyBack() {
    const current = this.editor.getText()
    this.editor.setText(this.history.goBack(current))
  }

  public historyForward() {
    this.editor.setText(this.history.goForward())
  }

  public clear() {
    this.messages = []
    // tslint:disable-next-line:no-floating-promises
    this.update()
  }

  public getURI() {
    return `ide-haskell://repl/${this.uri}`
  }

  public getTitle() {
    return `REPL: ${this.uri}`
  }

  public async destroy() {
    await etch.destroy(this)
    this.destroyed = true
    this.disposables.dispose()
    return super.destroy()
  }

  public serialize(): IViewStateOutput {
    return {
      deserializer: 'IdeHaskellReplView',
      uri: this.uri,
      content: this.messages,
      history: this.history.serialize(),
      autoReloadRepeat: this.autoReloadRepeat,
      focus: this.isFocused(),
    }
  }

  public async update() {
    const atEnd =
      !!this.refs &&
      this.refs.output.scrollTop + this.refs.output.clientHeight >=
        this.refs.output.scrollHeight
    const focused = this.isFocused()
    await etch.update(this)
    if (atEnd) {
      this.refs.output.scrollTop =
        this.refs.output.scrollHeight - this.refs.output.clientHeight
    }
    if (focused) {
      this.focus()
    }
  }

  public render() {
    return (
      // tslint:disable:no-unsafe-any
      <div
        className="ide-haskell-repl"
        tabIndex="-1"
        on={{ focus: this.focus }}
      >
        <div
          ref="output"
          className="ide-haskell-repl-output native-key-bindings"
          tabIndex="-1"
          style={{
            fontSize: this.outputFontSize,
            fontFamily: this.outputFontFamily,
          }}
        >
          {this.renderOutput()}
        </div>
        {this.renderErrDiv()}
        <div className="button-container">
          {this.renderPrompt()}
          <Button
            cls="reload-repeat"
            tooltip="Reload file and repeat last command"
            command="ide-haskell-repl:reload-repeat"
            parent={this}
          />
          <Button
            cls="auto-reload-repeat"
            tooltip="Toggle reload-repeat on file save"
            command="ide-haskell-repl:toggle-auto-reload-repeat"
            state={this.autoReloadRepeat}
            parent={this}
          />
          <Button
            cls="interrupt"
            tooltip="Interrupt current computation"
            command="ide-haskell-repl:ghci-interrupt"
            parent={this}
          />
          <Button
            cls="clear"
            tooltip="Clear output"
            command="ide-haskell-repl:clear-output"
            parent={this}
          />
        </div>
        <div className="ide-haskell-repl-editor">
          <div className="editor-container">
            <Editor ref="editor" element={atom.views.getView(this.editor)} />
          </div>
        </div>
      </div>
      // tslint:enable:no-unsafe-any
    )
  }

  protected async onInitialLoad() {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    const res = await this.ghci.load(this.uri)
    this.prompt = res.prompt[1]
    this.errorsFromStderr(res.stderr)
    return super.onInitialLoad()
  }

  private renderErrDiv() {
    if (!this.upi) {
      return <div className="ide-haskell-repl-error">{this.renderErrors()}</div>
    } else {
      // tslint:disable-next-line: no-null-keyword
      return null
    }
  }

  private renderErrors() {
    return this.errors.map((err) => this.renderError(err))
  }

  private renderError(error: IErrorItem) {
    const pos = error.position ? Point.fromObject(error.position) : undefined
    const uri = error.uri || '<interactive>'
    const positionText = pos ? `${uri}: ${pos.row + 1}, ${pos.column + 1}` : uri
    const context = error.context || ''
    return (
      // tslint:disable:no-unsafe-any
      <div>
        {positionText}: {error.severity}: {context}
        {error.message}
      </div>
      // tslint:enable:no-unsafe-any
    )
  }

  private renderPrompt() {
    return (
      // tslint:disable-next-line:no-unsafe-any
      <div class="repl-prompt">{this.prompt || ''}&gt;</div>
    )
  }

  private renderOutput() {
    const maxMsg = atom.config.get('ide-haskell-repl.maxMessages')
    if (maxMsg > 0) {
      this.messages = this.messages.slice(-maxMsg)
    }
    return this.messages.map((msg: IContentItem) => {
      const { text, cls, hl } = msg
      let { hlcache } = msg
      const cleanText = text.replace(termEscapeRx, '')
      if (hl) {
        if (!hlcache) {
          hlcache = msg.hlcache = highlightSync({
            fileContents: cleanText,
            scopeName: 'source.haskell',
            nbsp: false,
          })
        }
        return (
          // tslint:disable-next-line:no-unsafe-any
          <pre className={cls} innerHTML={hlcache} />
        )
      } else {
        // tslint:disable-next-line:no-unsafe-any
        return <pre className={cls}>{cleanText}</pre>
      }
    })
  }

  private isFocused() {
    return (
      !!this.refs &&
      !!document.activeElement &&
      this.refs.editor.element.contains(document.activeElement)
    )
  }

  private async registerEditor() {
    const we = await this.props.watchEditorPromise
    if (this.destroyed) return
    this.disposables.add(we(this.editor, ['ide-haskell-repl']))
  }
}
