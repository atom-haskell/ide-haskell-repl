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
import {Button} from './button'
import {Editor} from './editor'

export {IViewState, IContentItem}

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

interface IViewStateOutput extends IViewState {
  deserializer: string
}

export class IdeHaskellReplView extends IdeHaskellReplBase {
  public refs: {[key: string]: any}
  public editor: TextEditor
  private outputFontFamily: any
  private outputFontSize: any
  private disposables: CompositeDisposable
  constructor (upiPromise, state: IViewState) {
    super(upiPromise, state)
    this.disposables = new CompositeDisposable()

    this.editor = new TextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
      grammar: atom.grammars.grammarForScopeName('source.haskell'),
    })

    atom.textEditors.add(this.editor)

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

    etch.initialize(this)
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

  public historyBack () {
    let current = this.editor.getText()
    this.editor.setText(this.history.goBack(current))
  }

  public historyForward () {
    this.editor.setText(this.history.goForward())
  }

  public getURI () {
    return `ide-haskell://repl/${this.uri}`
  }

  public getTitle () {
    return `REPL: ${this.uri}`
  }

  public async destroy () {
    etch.destroy(this)
    this.disposables.dispose()
    super.destroy()
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

  public async update () {
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
      <div>{this.prompt || ''}&gt;</div>
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
}
