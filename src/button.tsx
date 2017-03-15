'use babel'

import etch from 'etch'
import { CompositeDisposable } from "atom";
import IdeHaskellReplView from "./ide-haskell-repl-view";

interface Props {
    cls: string
    parent: IdeHaskellReplView
    tooltip: string | (() => String)
    command: string
  };

export class Button {
  element: HTMLElement;
  target: HTMLElement;
  props: Props;
  destroyed: boolean;
  disposables: any;
  clslst: Set<any>;
  constructor (props: Props) {
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
