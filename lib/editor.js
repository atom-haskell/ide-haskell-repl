"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Editor {
    constructor({ element }) {
        this.element = element;
        element.classList.add('ide-haskell-repl');
    }
    update({ element }) {
        this.element = element;
        element.classList.add('ide-haskell-repl');
    }
}
exports.Editor = Editor;
//# sourceMappingURL=editor.js.map