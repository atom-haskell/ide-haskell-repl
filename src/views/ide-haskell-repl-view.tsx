import {
  CompositeDisposable,
  TextEditor,
} from 'atom'
import highlightSync = require('atom-highlight')
import etch = require('etch')

import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
} from '../ide-haskell-repl-base'
import { Button } from './button'
import { Editor } from './editor'

export { IViewState, IContentItem }

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

interface IViewStateOutput extends IViewState {
  deserializer: string
}

export interface IProps extends JSX.Props { upiPromise: Promise<UPI.IUPIInstance>, state: IViewState }

export class IdeHaskellReplView extends IdeHaskellReplBase implements JSX.ElementClass {
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
  constructor(public props: IProps) {
    super(props.upiPromise, props.state)
    this.disposables = new CompositeDisposable()

    this.editor = atom.workspace.buildTextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
    })
    this.editor.setGrammar(atom.grammars.grammarForScopeName('source.haskell'))

    atom.textEditors.add(this.editor)

    this.disposables.add(
      atom.workspace.observeTextEditors((editor: TextEditor) => {
        if (editor.getPath() === this.uri) {
          this.disposables.add(editor.onDidSave(() => {
            if (this.autoReloadRepeat) { this.ghciReloadRepeat() }
          }))
        }
      }),
    )
    this.disposables.add(atom.config.observe('editor.fontSize', (fontSize: number) => {
      this.outputFontSize = `${fontSize}px`
    }))
    this.disposables.add(atom.config.observe('editor.fontFamily', (fontFamily: string) => {
      this.outputFontFamily = fontFamily
    }))

    etch.initialize(this)
  }

  public async execCommand() {
    const inp = this.editor.getBuffer().getText()
    this.editor.setText('')
    if (this.ghci && this.ghci.isBusy()) {
      this.messages.push({ text: inp, hl: false, cls: 'ide-haskell-repl-input-text' })
      this.ghci.writeRaw(inp)
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
    this.update()
  }

  public getURI() {
    return `ide-haskell://repl/${this.uri}`
  }

  public getTitle() {
    return `REPL: ${this.uri}`
  }

  public async destroy() {
    etch.destroy(this)
    this.disposables.dispose()
    super.destroy()
  }

  public serialize(): IViewStateOutput {
    return {
      deserializer: 'IdeHaskellReplView',
      uri: this.uri,
      content: this.messages,
      history: this.history.serialize(),
      autoReloadRepeat: this.autoReloadRepeat,
    }
  }

  public async update() {
    const atEnd = !!this.refs &&
      (this.refs.output.scrollTop + this.refs.output.clientHeight >= this.refs.output.scrollHeight)
    const focused = !!this.refs && !!document.activeElement &&
      (this.refs.editor.element.contains(document.activeElement))
    await etch.update(this)
    if (atEnd) {
      this.refs.output.scrollTop = this.refs.output.scrollHeight - this.refs.output.clientHeight
    }
    if (focused) {
      this.refs.editor.element.focus()
    }
  }

  public render() {
    return (
      <div className="ide-haskell-repl">
        <div
          ref="output"
          className="ide-haskell-repl-output native-key-bindings"
          tabIndex="-1"
          style={{ fontSize: this.outputFontSize, fontFamily: this.outputFontFamily }}
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
    )
  }

  protected async onInitialLoad() {
    if (!this.ghci) { throw new Error('No GHCI instance!') }
    const res = await this.ghci.load(this.uri)
    this.prompt = res.prompt[1]
    this.errorsFromStderr(res.stderr)
    return super.onInitialLoad()
  }

  private renderErrDiv() {
    if (!this.upi) {
      return (
        <div className="ide-haskell-repl-error">
          {this.errors/*TODO render*/}
        </div>
      )
    } else { return null } // tslint:disable-line: no-null-keyword
  }

  private renderPrompt() {
    return (
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
          hlcache = msg.hlcache = highlightSync({ fileContents: cleanText, scopeName: 'source.haskell', nbsp: false })
        }
        return (
          <pre className={cls} innerHTML={hlcache} />
        )
      } else {
        return <pre className={cls}>{cleanText}</pre>
      }
    })
  }
}
