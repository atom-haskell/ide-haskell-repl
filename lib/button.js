"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const etch = require("etch");
;
class Button {
    constructor(props) {
        this.props = props;
        this.destroyed = false;
        this.disposables = new atom_1.CompositeDisposable();
        this.clslst = new Set();
        this.clslst.add(this.props.cls);
        etch.initialize(this);
        this.target = this.props.parent.refs.editor.element;
        this.disposables.add(atom.tooltips.add(this.element, {
            title: this.props.tooltip,
            keyBindingCommand: this.props.command,
            keyBindingTarget: this.target,
        }));
    }
    render() {
        return (etch.dom("button", { className: Array.from(this.clslst.values()).join(' '), on: { click: this.click } }));
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            yield etch.destroy(this);
            this.destroyed = true;
            this.disposables.dispose();
        });
    }
    update({ state }) {
        if (state) {
            this.clslst.add('enabled');
        }
        else {
            this.clslst.delete('enabled');
        }
        etch.update(this);
    }
    click() {
        if (this.target) {
            atom.commands.dispatch(this.target, this.props.command);
        }
    }
}
exports.Button = Button;
//# sourceMappingURL=button.js.map