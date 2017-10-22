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
class Editor {
    constructor(props) {
        this.props = props;
        this.element = props.element;
        this.element.classList.add('ide-haskell-repl');
    }
    update(props) {
        return __awaiter(this, void 0, void 0, function* () {
            this.element = props.element;
            this.element.classList.add('ide-haskell-repl');
            return Promise.resolve();
        });
    }
}
exports.Editor = Editor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2VkaXRvci50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUdBO0lBRUUsWUFBb0IsS0FBYTtRQUFiLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDL0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFBO1FBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0lBQ2hELENBQUM7SUFFWSxNQUFNLENBQUUsS0FBYTs7WUFDaEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFBO1lBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO1lBQzlDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUE7UUFDMUIsQ0FBQztLQUFBO0NBQ0Y7QUFaRCx3QkFZQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIGV4dGVuZHMgSlNYLlByb3BzIHtlbGVtZW50OiBIVE1MRWxlbWVudH1cblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbmV4cG9ydCBjbGFzcyBFZGl0b3IgaW1wbGVtZW50cyBKU1guRWxlbWVudENsYXNzIHtcbiAgcHVibGljIGVsZW1lbnQ6IEhUTUxFbGVtZW50XG4gIGNvbnN0cnVjdG9yIChwdWJsaWMgcHJvcHM6IElQcm9wcykge1xuICAgIHRoaXMuZWxlbWVudCA9IHByb3BzLmVsZW1lbnRcbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaWRlLWhhc2tlbGwtcmVwbCcpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgdXBkYXRlIChwcm9wczogSVByb3BzKSB7XG4gICAgdGhpcy5lbGVtZW50ID0gcHJvcHMuZWxlbWVudFxuICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpZGUtaGFza2VsbC1yZXBsJylcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgfVxufVxuIl19