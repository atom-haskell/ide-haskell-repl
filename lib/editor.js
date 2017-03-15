'use babel';
export class Editor {
    constructor({ element }) {
        this.element = element;
        element.classList.add('ide-haskell-repl');
    }
    update({ element }) {
        this.element = element;
        element.classList.add('ide-haskell-repl');
    }
}
