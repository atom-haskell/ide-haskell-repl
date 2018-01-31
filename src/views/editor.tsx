export interface IProps extends JSX.Props {
  element: HTMLElement
}

// tslint:disable-next-line:no-unsafe-any
export class Editor implements JSX.ElementClass {
  public element: HTMLElement
  constructor(public props: IProps) {
    this.element = props.element
    this.element.classList.add('ide-haskell-repl')
  }

  public async update(props: IProps) {
    this.element = props.element
    this.element.classList.add('ide-haskell-repl')
    return Promise.resolve()
  }
}
