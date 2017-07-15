export class Editor {
  public element: HTMLElement
  constructor ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }

  public update ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }
}