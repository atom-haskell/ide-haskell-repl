'use babel'
/** @jsx etch.dom */
/* eslint no-control-regex: "off" */

import {Emitter, CompositeDisposable, TextEditor} from 'atom'
import GHCI from './ghci'
import Util from 'atom-haskell-utils'
import highlightSync from 'atom-highlight'
import {filter} from 'fuzzaldrin'
import etch from 'etch'

const termEscapeRx = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g

class Button {
  constructor (props) {
    this.props = props
    this.target = null
    this.destroyed = false
    this.disposables = new CompositeDisposable()
    this.clslst = new Set()
    this.clslst.add(this.props.cls)
    etch.initialize(this)
    this.target = this.props.parent.refs.editor.element
    this.disposables.add(atom.tooltips.add(this.element, {
      title: this.props.tooltip,
      keyBindingCommand: this.props.command,
      keyBindingTarget: this.target
    }))
  }

  render () {
    return (
      <button
        className={Array.from(this.clslst.values()).join(' ')}
        on={{click: this.click}} />
    )
  }

  async destroy () {
    await etch.destroy(this)
    this.destroyed = true
    this.disposables.dispose()
  }

  update ({state}) {
    if (state) this.clslst.add('enabled')
    else this.clslst.delete('enabled')
    etch.update(this)
  }

  click () {
    if (this.target) atom.commands.dispatch(this.target, this.props.command)
  }
}

class Editor {
  constructor ({element}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }

  update ({element}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }
}

export default class IdeHaskellReplView {
  constructor ({uri, content, history, upiPromise, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat')}) {
    this.uri = uri
    this.history = history
    this.autoReloadRepeat = autoReloadRepeat
    this.upiPromise = upiPromise
    this.disposables = new CompositeDisposable()
    this.emitter = new Emitter()
    this.disposables.add(this.emitter)

    this.editors = new Set()

    this.editor = new TextEditor({
      lineNumberGutterVisible: false,
      softWrapped: true,
      grammar: atom.grammars.grammarForScopeName('source.haskell')
    })

    this.messages = content || []

    etch.initialize(this)

    this.disposables.add(
      atom.workspace.observeTextEditors((editor) => {
        if (editor.getURI() === this.uri) {
          this.disposables.add(editor.onDidSave(() => {
            if (this.autoReloadRepeat) this.ghciReloadRepeat()
          }))
        }
      })
    )

    this.initialize()
  }

  render () {
    return (
      <div className='ide-haskell-repl'>
        <div className='ide-haskell-repl-output native-key-bindings' tabIndex='-1'
          style={{fontSize: this.outputFontSize, fontFamily: this.outputFontFamily}}>
          {this.renderOutput()}
        </div>
        {this.renderErrDiv()}
        {this.renderPrompt()}
        <div className='ide-haskell-repl-editor'>
          <div className='editor-container'>
            <Editor ref='editor' element={this.editor.element}
              />
          </div>
          <Button
            cls='reload-repeat'
            tooltip='Reload file and repeat last command'
            command='ide-haskell-repl:reload-repeat'
            parent={this}/>
          <Button
            cls='auto-reload-repeat'
            tooltip='Toggle reload-repeat on file save'
            command='ide-haskell-repl:toggle-auto-reload-repeat'
            state={this.autoReloadRepeat}
            parent={this}/>
          <Button
            cls='interrupt'
            tooltip='Interrupt current computation'
            command='ide-haskell-repl:ghci-interrupt'
            parent={this}/>
        </div>
      </div>
    )
  }

  renderErrDiv () {
    if (!this.upi) {
      return (
        <div className='ide-haskell-repl-error'>
          {this.errorText || ''}
        </div>
      )
    } else return null
  }

  renderPrompt () {
    return (
      <div>{this.prompt || ''} &gt;</div>
    )
  }

  renderOutput () {
    return this.messages.map(({text, cls, hl}) => {
      if (hl) {
        return (
          <pre className={cls} innerHTML={highlightSync({fileContents: text, scopeName: 'source.haskell', nbsp: false})} / >
        )
      } else {
        return <pre className={cls}>{text}</pre>
      }
    })
  }

  update () {
    return etch.update(this)
  }

  initialize () {
    this.disposables.add(atom.config.observe('editor.fontSize', (fontSize) => {
      this.outputFontSize = `${fontSize}px`
    }))
    this.disposables.add(atom.config.observe('editor.fontFamily', (fontFamily) => {
      this.outputFontFamily = fontFamily
    }))

    this.editor.setText('')

    this.cwd = Util.getRootDir(this.uri)

    this.setAutoReloadRepeat(this.autoReloadRepeat)

    this.doRunRepl()
  }

  async doRunRepl () {
    this.upi = await this.upiPromise
    if (!this.upi) return this.runRepl()
    this.update()

    try {
      let builder = await this.upi.params.get('ide-haskell-cabal', 'builder')
      this.runREPL((builder || {}).name)
    } catch (error) {
      if (error) {
        atom.notifications.addFatalError(error.toString(), {
          detail: error,
          dismissable: true
        })
        this.destroy()
      } else {
        atom.notifications.addWarning("Can't run REPL without knowing what builder to use")
        this.destroy()
      }
    }
  }

  runREPL (builder) {
    this.editor.element.focus()
    this.disposables.add(atom.workspace.onDidChangeActivePaneItem((item) => {
      if (item === this) { setImmediate(() => { this.editor.element.focus() }) }
    }))

    if (!builder) { builder = atom.config.get('ide-haskell-repl.defaultRepl') }
    let subst = {
      'nix-build': 'cabal',
      'none': 'ghci'
    }
    builder = (subst[builder] || builder)

    let [cabalFile] =
      this.cwd.getEntriesSync().filter((file) =>
        file.isFile() && file.getBaseName().endsWith('.cabal'))

    let cabal
    if (cabalFile) {
      let cabalContents = cabalFile.readSync()
      cabal = Util.parseDotCabalSync(cabalContents)
      var [comp] = Util.getComponentFromFileSync(cabalContents, this.cwd.relativize(this.uri))
    }
    let commandPath = atom.config.get(`ide-haskell-repl.${builder}Path`)

    let args = {
      stack: ['ghci'],
      cabal: ['repl'],
      ghci: []
    }
    let extraArgs = {
      stack: (x) => '--ghci-options="#{x}"',
      cabal: (x) => '--ghc-option=#{x}',
      ghci: (x) => x
    }

    if (!args[builder]) throw new Error('Unknown builder #{builder}')
    let commandArgs = args[builder]

    commandArgs.push(...(atom.config.get('ide-haskell-repl.extraArgs').map(extraArgs[builder])))

    if (comp) {
      if (builder === 'stack') {
        if (comp.startsWith('lib:')) comp = 'lib'
        comp = `${cabal.name}:${comp}`
        commandArgs.push('--main-is', comp)
      } else commandArgs.push(comp)
    }

    this.ghci = new GHCI({
      atomPath: process.execPath,
      command: commandPath,
      args: commandArgs,
      cwd: this.cwd.getPath(),
      load: this.uri,
      history: this.history,
      onResponse: (response) => { this.log(response.replace(termEscapeRx, '')) },
      onInput: (input) => this.logInput(input.replace(termEscapeRx, '')),
      onMessage: (message) => this.logMessage(message.replace(termEscapeRx, '')),
      onError: (error) => this.setError(error.replace(termEscapeRx, '')),
      onFinished: (prompt) => this.setPrompt(prompt.replace(termEscapeRx, '')),
      onExit: (code) => this.destroy()
    })
  }

  execCommand () {
    if (this.ghci.writeLines(this.editor.getBuffer().getLines())) { this.editor.setText('') }
  }

  copyText (command) {
    this.editor.setText(command)
    this.editor.element.focus()
  }

  runCommand (command, time = Date.now()) {
    if (!this.ghci) {
      this.setError('runCommand: no GHCi instance')
      return
    }
    if (!this.ghci.isActive()) {
      this.setError('runCommand: GHCi instance is inactive')
      return
    }
    let dt = Date.now() - time
    if (dt > 10000) {
      this.setError('runCommand: timeout after #{dt / 1000} seconds')
      return
    }
    if (!this.ghci.writeLines(command.split('\n'))) { setTimeout(() => this.runCommand(command), 100) }
  }

  historyBack () {
    this.editor.setText(this.ghci.historyBack(this.editor.getText()))
  }

  historyForward () {
    this.editor.setText(this.ghci.historyForward())
  }

  ghciReload () {
    this.ghci.reload()
  }

  ghciReloadRepeat () {
    if (!this.ghci) return
    this.ghci.reloadRepeat()
  }

  toggleAutoReloadRepeat () {
    this.setAutoReloadRepeat(!this.getAutoReloadRepeat())
  }

  setAutoReloadRepeat (autoReloadRepeat) {
    this.autoReloadRepeat = autoReloadRepeat
    this.update() // TODO: update only sync button?
  }

  getAutoReloadRepeat () {
    return this.autoReloadRepeat
  }

  interrupt () {
    this.ghci.interrupt()
  }

  setPrompt (prompt) {
    this.prompt = prompt
    this.update() // TODO
  }

  getCompletions (prefix) {
    if (!prefix.trim()) return []
    return new Promise((resolve, reject) => {
      if (!this.ghci.sendCompletionRequest() && this.completionHandler) {
        this.completionHandler.dispose()
      }
      this.completionHandler =
        this.ghci.onComplete((lines) => {
          let lines_ =
            lines.slice(1)
            .map((line) => line.slice(1, -1))
          let suggestions =
            filter(lines_, prefix)
            .map((result) => { return {text: result} })
          resolve(suggestions)
          this.completionHandler.dispose()
        })
    })
  }

  setError (err) {
    let time = Date.now()
    if (!this.lastErrorTime) this.lastErrorTime = time
    if (time - this.lastErrorTime > 1000) {
      if (this.upi) { this.upi.messages.set(this.splitErrBuffer(err)) } else {
        this.errorText = err.trim()
        this.update() // TODO: update only error div
      }
    } else
      if (this.upi) { this.upi.messages.add(this.splitErrBuffer(err)) } else {
        if (this.errorText) {
          this.errorText = `${this.errorText.trim()}\n\n${err.trim()}`
        } else {
          this.errorText = err.trim()
        }
      }
    this.lastErrorTime = time
  }

  splitErrBuffer (errBuffer) {
    // Start of a Cabal message
    let startOfMessage = /\n\S/
    let som = errBuffer.search(startOfMessage)
    function * msgsG () {
      while (som >= 0) {
        let errMsg = errBuffer.substr(0, som + 1)
        errBuffer = errBuffer.substr(som + 1)
        som = errBuffer.search(startOfMessage)
        let msg = this.parseMessage(errMsg)
        if (msg) yield msg
      }
    }
    let msgs = Array.from(msgsG.bind(this)())
    // Try to parse whatever is left in the buffer
    msgs.push(this.parseMessage(errBuffer))
    return msgs.filter((msg) => msg)
  }

  unindentMessage (message) {
    let lines = message.split('\n')
    let minIndent = null
    for (let line of lines) {
      let match = line.match(/^[\t\s]*/)
      let lineIndent = match[0].length
      if (lineIndent < minIndent || !minIndent) { minIndent = lineIndent }
    }
    if (minIndent) {
      lines = lines.map((line) => line.slice(minIndent))
    }
    return lines.join('\n')
  }

  parseMessage (raw) {
    // Regular expression to match against a location in a cabal msg (Foo.hs:3:2)
    // The [^] syntax basically means "anything at all" (including newlines)
    let matchLoc = /(\S+):(\d+):(\d+):( Warning:)?\n?([^]*)/
    if (raw.trim() !== '') {
      let matched = raw.match(matchLoc)
      if (matched) {
        let [file, line, col, rawTyp, msg] = matched.slice(1, 6)
        let typ = rawTyp ? 'warning' : 'error'
        if (file === '<interactive>') {
          file = undefined
          typ = 'repl'
        }

        return {
          uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : null,
          position: [parseInt(line) - 1, parseInt(col) - 1],
          message: this.unindentMessage(msg.trimRight()),
          severity: typ
        }
      } else {
        return {
          message: raw,
          severity: 'repl'
        }
      }
    }
  }

  log (text) {
    this.messages.push({text, hl: true, cls: 'ide-haskell-repl-output-text'})
    this.update() // TODO: update only output
  }

  logInput (text) {
    this.messages.push({text, hl: true, cls: 'ide-haskell-repl-input-text'})
    this.update() // TODO: update only output
  }

  logMessage (text) {
    this.messages.push({text, cls: 'ide-haskell-repl-message-text'})
    this.update() // TODO: update only output
  }

  getURI () {
    return `ide-haskell://repl/${this.uri}`
  }

  getTitle () {
    return `REPL: ${this.uri}`
  }

  onDidDestroy (callback) {
    return this.emitter.on('did-destroy', callback)
  }

  async destroy () {
    etch.destroy(this)
    if (this.ghci) this.ghci.destroy()
    this.emitter.emit('did-destroy')
    this.disposables.dispose()
  }

  serialize () {
    return {
      deserializer: 'IdeHaskellReplView',
      uri: this.uri,
      upi: !!(this.upi),
      content: this.messages,
      history: this.ghci.history.back,
      autoReloadRepeat: this.autoReloadRepeat
    }
  }
}
