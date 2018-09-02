import { CompositeDisposable } from 'atom'
import etch = require('etch')
import { IdeHaskellReplView } from './ide-haskell-repl-view'

export interface IProps extends JSX.Props {
  cls: string
  parent: IdeHaskellReplView
  tooltip: string | (() => string)
  command: string
  state?: boolean
}

// tslint:disable-next-line:no-unsafe-any
export class Button implements JSX.ElementClass {
  private element!: HTMLElement
  private target: HTMLElement
  private disposables: CompositeDisposable
  private clslst: Set<string>
  constructor(public props: IProps) {
    this.disposables = new CompositeDisposable()
    this.clslst = new Set()
    this.clslst.add(this.props.cls)
    this.updateState(this.props.state)
    etch.initialize(this)
    this.target = atom.views.getView(this.props.parent.editor)
    this.disposables.add(
      atom.tooltips.add(this.element, {
        title: this.props.tooltip,
        keyBindingCommand: this.props.command,
        keyBindingTarget: this.target,
      }),
    )
  }

  public render() {
    return (
      // tslint:disable:no-unsafe-any
      <button
        className={Array.from(this.clslst.values()).join(' ')}
        on={{ click: this.click.bind(this) }}
      />
      // tslint:enable:no-unsafe-any
    )
  }

  public async destroy() {
    await etch.destroy(this)
    this.disposables.dispose()
  }

  public async update(props: IProps) {
    if (this.props.state === props.state) {
      return Promise.resolve()
    }
    this.props.state = props.state
    this.updateState(this.props.state)
    return etch.update(this)
  }

  public click() {
    if (this.target) {
      atom.commands.dispatch(this.target, this.props.command)
    }
  }

  private updateState(state?: boolean) {
    if (state) {
      this.clslst.add('enabled')
    } else {
      this.clslst.delete('enabled')
    }
  }
}
