import { CompositeDisposable } from 'atom'
import etch = require('etch')
import {IdeHaskellReplView} from './ide-haskell-repl-view'

interface IProps {
    cls: string
    parent: IdeHaskellReplView
    tooltip: string | (() => String)
    command: string
  };

export class Button {
  private element: HTMLElement
  private target: HTMLElement
  private props: IProps
  private destroyed: boolean
  private disposables: any
  private clslst: Set<any>
  constructor (props: IProps) {
    this.props = props
    this.destroyed = false
    this.disposables = new CompositeDisposable()
    this.clslst = new Set()
    this.clslst.add(this.props.cls)
    etch.initialize(this)
    this.target = this.props.parent.refs.editor.element
    this.disposables.add(atom.tooltips.add(this.element, {
      title: this.props.tooltip,
      keyBindingCommand: this.props.command,
      keyBindingTarget: this.target,
    }))
  }

  public render () {
    return (
      <button
        className={Array.from(this.clslst.values()).join(' ')}
        on={{click: this.click}} />
    )
  }

  public async destroy () {
    await etch.destroy(this)
    this.destroyed = true
    this.disposables.dispose()
  }

  public update ({state}) {
    if (state) {
      this.clslst.add('enabled')
    } else {
      this.clslst.delete('enabled')
    }
    etch.update(this)
  }

  public click () {
    if (this.target) {
      atom.commands.dispatch(this.target, this.props.command)
    }
  }
}
