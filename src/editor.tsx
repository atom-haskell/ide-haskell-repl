'use babel'

export class Editor {
  element: HTMLElement
  constructor ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }

  update ({element}: {element: HTMLElement}) {
    this.element = element
    element.classList.add('ide-haskell-repl')
  }
}
