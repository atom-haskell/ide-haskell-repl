import {
  CompositeDisposable,
} from 'atom'

import {
  IContentItem,
  IdeHaskellReplBase,
  IViewState,
} from './ide-haskell-repl-base'

export {IViewState, IContentItem}

export class IdeHaskellReplBg extends IdeHaskellReplBase {
  private disposables: CompositeDisposable
  constructor (upiPromise, state: IViewState) {
    super(upiPromise, state)
    this.disposables = new CompositeDisposable()
  }

  public async destroy () {
    this.disposables.dispose()
    super.destroy()
  }

  public async update () {
    // noop
  }

  protected async onLoad () {
    this.getAllTypes ()
  }

  protected async onInitialLoad () {
    await this.ghci.writeLines([':set +c'])
    await this.ghciReload()
    return super.onInitialLoad()
  }
}
