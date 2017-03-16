'use babel'

export class Editor {
  private element: HTMLElement
  constructor ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }

  public update ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }
}
