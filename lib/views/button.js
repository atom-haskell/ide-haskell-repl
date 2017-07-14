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
class Button {
    constructor(props) {
        this.props = props;
        this.destroyed = false;
        this.disposables = new atom_1.CompositeDisposable();
        this.clslst = new Set();
        this.clslst.add(this.props.cls);
        etch.initialize(this);
        this.target = this.props.parent.editor.element;
        this.disposables.add(atom.tooltips.add(this.element, {
            title: this.props.tooltip,
            keyBindingCommand: this.props.command,
            keyBindingTarget: this.target,
        }));
    }
    render() {
        return (etch.dom("button", { className: Array.from(this.clslst.values()).join(' '), on: { click: this.click.bind(this) } }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFVN0I7SUFRRSxZQUFhLEtBQWE7UUFDeEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUE7UUFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUE7UUFDdEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLDBCQUFtQixFQUFFLENBQUE7UUFDNUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFBO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDL0IsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUE7UUFDOUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPO1lBQ3pCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTztZQUNyQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsTUFBTTtTQUM5QixDQUFDLENBQUMsQ0FBQTtJQUNMLENBQUM7SUFFTSxNQUFNO1FBQ1gsTUFBTSxDQUFDLENBQ0wscUJBQ0UsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDckQsRUFBRSxFQUFFLEVBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUksQ0FDekMsQ0FBQTtJQUNILENBQUM7SUFFWSxPQUFPOztZQUNsQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDeEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUE7WUFDckIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtRQUM1QixDQUFDO0tBQUE7SUFFTSxNQUFNLENBQUUsRUFBQyxLQUFLLEVBQW1CO1FBQ3RDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDVixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUM1QixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUMvQixDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNuQixDQUFDO0lBRU0sS0FBSztRQUNWLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUN6RCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbkRELHdCQW1EQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJ1xuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxWaWV3fSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuaW50ZXJmYWNlIElQcm9wcyB7XG4gICAgY2xzOiBzdHJpbmdcbiAgICBwYXJlbnQ6IElkZUhhc2tlbGxSZXBsVmlld1xuICAgIHRvb2x0aXA6IHN0cmluZyB8ICgoKSA9PiBzdHJpbmcpXG4gICAgY29tbWFuZDogc3RyaW5nXG4gIH1cblxuZXhwb3J0IGNsYXNzIEJ1dHRvbiB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBlbGVtZW50OiBIVE1MRWxlbWVudFxuICBwcml2YXRlIHRhcmdldDogSFRNTEVsZW1lbnRcbiAgcHJpdmF0ZSBwcm9wczogSVByb3BzXG4gIHByaXZhdGUgZGVzdHJveWVkOiBib29sZWFuXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgcHJpdmF0ZSBjbHNsc3Q6IFNldDxzdHJpbmc+XG4gIGNvbnN0cnVjdG9yIChwcm9wczogSVByb3BzKSB7XG4gICAgdGhpcy5wcm9wcyA9IHByb3BzXG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG4gICAgdGhpcy5jbHNsc3QgPSBuZXcgU2V0KClcbiAgICB0aGlzLmNsc2xzdC5hZGQodGhpcy5wcm9wcy5jbHMpXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLnByb3BzLnBhcmVudC5lZGl0b3IuZWxlbWVudFxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20udG9vbHRpcHMuYWRkKHRoaXMuZWxlbWVudCwge1xuICAgICAgdGl0bGU6IHRoaXMucHJvcHMudG9vbHRpcCxcbiAgICAgIGtleUJpbmRpbmdDb21tYW5kOiB0aGlzLnByb3BzLmNvbW1hbmQsXG4gICAgICBrZXlCaW5kaW5nVGFyZ2V0OiB0aGlzLnRhcmdldCxcbiAgICB9KSlcbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8YnV0dG9uXG4gICAgICAgIGNsYXNzTmFtZT17QXJyYXkuZnJvbSh0aGlzLmNsc2xzdC52YWx1ZXMoKSkuam9pbignICcpfVxuICAgICAgICBvbj17e2NsaWNrOiB0aGlzLmNsaWNrLmJpbmQodGhpcyl9fSAvPlxuICAgIClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBhd2FpdCBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWVcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICB9XG5cbiAgcHVibGljIHVwZGF0ZSAoe3N0YXRlfToge3N0YXRlOiBib29sZWFufSkge1xuICAgIGlmIChzdGF0ZSkge1xuICAgICAgdGhpcy5jbHNsc3QuYWRkKCdlbmFibGVkJylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbHNsc3QuZGVsZXRlKCdlbmFibGVkJylcbiAgICB9XG4gICAgZXRjaC51cGRhdGUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBjbGljayAoKSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICBhdG9tLmNvbW1hbmRzLmRpc3BhdGNoKHRoaXMudGFyZ2V0LCB0aGlzLnByb3BzLmNvbW1hbmQpXG4gICAgfVxuICB9XG59XG4iXX0=