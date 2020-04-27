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
import { UPIConsumer } from '../upiConsumer'
import { handlePromise } from '../util'

export { IViewState, IContentItem, IRequestResult }

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

export interface IViewStateOutput extends IViewState {
  deserializer: string
}

export interface IProps extends JSX.Props {
  upiPromise: Promise<UPIConsumer | undefined>
  state: IViewState
  watchEditorPromise: Promise<TWatchEditor>
}

export interface UpdateProps extends JSX.Props {
  outputFontFamily: string
  outputFontSize: number
}

// tslint:disable-next-line:no-unsafe-any
export class IdeHaskellReplView extends IdeHaskellReplBase
  implements JSX.ElementClass {
  public refs!: {
    output: HTMLElement
    editor: Editor
  }
  public editor: TextEditor
  private fontSettings: UpdateProps
  private disposables: CompositeDisposable
  private destroyed: boolean = false
  private initialized: boolean = false
  constructor(public props: IProps) {
    super(props.upiPromise, props.state, `view:${props.state.uri}`)
    this.disposables = new CompositeDisposable()

    this.editor = atom.workspace.buildTextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
    })
    atom.grammars.assignLanguageMode(this.editor.getBuffer(), 'source.haskell')

    this.fontSettings = {
      outputFontSize: atom.config.get('editor.fontSize'),
      outputFontFamily: atom.config.get('editor.fontFamily'),
    }
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
      atom.config.onDidChange('editor.fontSize', ({ newValue }) => {
        handlePromise(this.update({ outputFontSize: newValue }))
      }),
      atom.config.onDidChange('editor.fontFamily', ({ newValue }) => {
        handlePromise(this.update({ outputFontFamily: newValue }))
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
    if (!this.initialized) return undefined
    const inp = this.editor.getBuffer().getText()
    this.editor.setText('')
    if (this.ghci && this.ghci.isBusy()) {
      this.messages.push({
        text: inp,
        hl: false,
        cls: 'ide-haskell-repl-input-stdin',
      })
      this.ghci.writeRaw(inp)
      await this.update()
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
    this.clearErrors()
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

  public async update(props?: Partial<UpdateProps>) {
    if (props) Object.assign(this.fontSettings, props)

    const atEnd =
      !!this.refs &&
      this.refs.output.scrollTop + this.refs.output.clientHeight >=
        this.refs.output.scrollHeight - this.fontSettings.outputFontSize
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
          key="output"
          className="ide-haskell-repl-output native-key-bindings"
          tabIndex="-1"
          style={{
            fontSize: `${this.fontSettings.outputFontSize}px`,
            fontFamily: this.fontSettings.outputFontFamily,
          }}
        >
          {this.renderOutput()}
        </div>
        {this.renderErrDiv()}
        <div key="buttons" className="button-container">
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
        <div key="editor" className="ide-haskell-repl-editor">
          <div className="editor-container">
            <Editor ref="editor" element={atom.views.getView(this.editor)} />
          </div>
          <Button
            cls="exec"
            tooltip="Run code"
            command="ide-haskell-repl:exec-command"
            parent={this}
          />
        </div>
      </div>
      // tslint:enable:no-unsafe-any
    )
  }

  protected async onInitialLoad() {
    if (!this.ghci) {
      throw new Error('No GHCI instance!')
    }
    await super.onInitialLoad()
    const res = await this.ghci.load(this.uri)
    this.prompt = res.prompt[1]
    this.errorsFromStderr(res.stderr)
    this.initialized = true
  }

  private renderErrDiv() {
    if (!this.upi) {
      return (
        <div
          className="native-key-bindings ide-haskell-repl-error"
          tabIndex="-1"
        >
          {this.renderErrors()}
        </div>
      )
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
      <div>
        {positionText}:{' '}
        <span className={`ide-haskell-repl-error-${error.severity}`}>
          {error.severity}
        </span>
        : {context}
        <div class="ide-haskell-repl-error-message">{error.message}</div>
      </div>
    )
  }

  private renderPrompt() {
    const busyClass =
      this.ghci && this.ghci.isBusy() ? ' ide-haskell-repl-busy' : ''
    return (
      // tslint:disable-next-line:no-unsafe-any
      <div class={`repl-prompt${busyClass}`}>
        {this.prompt || ''}
        &gt;
      </div>
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
