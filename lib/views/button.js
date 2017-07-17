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
        this.target = atom.views.getView(this.props.parent.editor);
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
    update(props) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.props.state === props.state) {
                return Promise.resolve();
            }
            this.props.state = props.state;
            if (this.props.state) {
                this.clslst.add('enabled');
            }
            else {
                this.clslst.delete('enabled');
            }
            return etch.update(this);
        });
    }
    click() {
        if (this.target) {
            atom.commands.dispatch(this.target, this.props.command);
        }
    }
}
exports.Button = Button;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFXN0I7SUFPRSxZQUFvQixLQUFhO1FBQWIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUMvQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUE7UUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUMvQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDMUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPO1lBQ3pCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTztZQUNyQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsTUFBTTtTQUM5QixDQUFDLENBQUMsQ0FBQTtJQUNMLENBQUM7SUFFTSxNQUFNO1FBQ1gsTUFBTSxDQUFDLENBQ0wscUJBQ0UsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDckQsRUFBRSxFQUFFLEVBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUksQ0FDekMsQ0FBQTtJQUNILENBQUM7SUFFWSxPQUFPOztZQUNsQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDeEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUE7WUFDckIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtRQUM1QixDQUFDO0tBQUE7SUFFWSxNQUFNLENBQUUsS0FBYTs7WUFDaEMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQTtZQUM5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBO1lBQzVCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtZQUMvQixDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDMUIsQ0FBQztLQUFBO0lBRU0sS0FBSztRQUNWLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUN6RCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbkRELHdCQW1EQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJ1xuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxWaWV3fSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuaW50ZXJmYWNlIElQcm9wcyBleHRlbmRzIEpTWC5Qcm9wcyB7XG4gICAgY2xzOiBzdHJpbmdcbiAgICBwYXJlbnQ6IElkZUhhc2tlbGxSZXBsVmlld1xuICAgIHRvb2x0aXA6IHN0cmluZyB8ICgoKSA9PiBzdHJpbmcpXG4gICAgY29tbWFuZDogc3RyaW5nXG4gICAgc3RhdGU/OiBib29sZWFuXG4gIH1cblxuZXhwb3J0IGNsYXNzIEJ1dHRvbiBpbXBsZW1lbnRzIEpTWC5FbGVtZW50Q2xhc3Mge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZC1jbGFzcy1wcm9wZXJ0aWVzXG4gIHByaXZhdGUgZWxlbWVudDogSFRNTEVsZW1lbnRcbiAgcHJpdmF0ZSB0YXJnZXQ6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgZGVzdHJveWVkOiBib29sZWFuXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgcHJpdmF0ZSBjbHNsc3Q6IFNldDxzdHJpbmc+XG4gIGNvbnN0cnVjdG9yIChwdWJsaWMgcHJvcHM6IElQcm9wcykge1xuICAgIHRoaXMuZGVzdHJveWVkID0gZmFsc2VcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuICAgIHRoaXMuY2xzbHN0ID0gbmV3IFNldCgpXG4gICAgdGhpcy5jbHNsc3QuYWRkKHRoaXMucHJvcHMuY2xzKVxuICAgIGV0Y2guaW5pdGlhbGl6ZSh0aGlzKVxuICAgIHRoaXMudGFyZ2V0ID0gYXRvbS52aWV3cy5nZXRWaWV3KHRoaXMucHJvcHMucGFyZW50LmVkaXRvcilcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLnRvb2x0aXBzLmFkZCh0aGlzLmVsZW1lbnQsIHtcbiAgICAgIHRpdGxlOiB0aGlzLnByb3BzLnRvb2x0aXAsXG4gICAgICBrZXlCaW5kaW5nQ29tbWFuZDogdGhpcy5wcm9wcy5jb21tYW5kLFxuICAgICAga2V5QmluZGluZ1RhcmdldDogdGhpcy50YXJnZXQsXG4gICAgfSkpXG4gIH1cblxuICBwdWJsaWMgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGJ1dHRvblxuICAgICAgICBjbGFzc05hbWU9e0FycmF5LmZyb20odGhpcy5jbHNsc3QudmFsdWVzKCkpLmpvaW4oJyAnKX1cbiAgICAgICAgb249e3tjbGljazogdGhpcy5jbGljay5iaW5kKHRoaXMpfX0gLz5cbiAgICApXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgYXdhaXQgZXRjaC5kZXN0cm95KHRoaXMpXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKHByb3BzOiBJUHJvcHMpIHtcbiAgICBpZiAodGhpcy5wcm9wcy5zdGF0ZSA9PT0gcHJvcHMuc3RhdGUpIHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpIH1cbiAgICB0aGlzLnByb3BzLnN0YXRlID0gcHJvcHMuc3RhdGVcbiAgICBpZiAodGhpcy5wcm9wcy5zdGF0ZSkge1xuICAgICAgdGhpcy5jbHNsc3QuYWRkKCdlbmFibGVkJylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbHNsc3QuZGVsZXRlKCdlbmFibGVkJylcbiAgICB9XG4gICAgcmV0dXJuIGV0Y2gudXBkYXRlKHRoaXMpXG4gIH1cblxuICBwdWJsaWMgY2xpY2sgKCkge1xuICAgIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgYXRvbS5jb21tYW5kcy5kaXNwYXRjaCh0aGlzLnRhcmdldCwgdGhpcy5wcm9wcy5jb21tYW5kKVxuICAgIH1cbiAgfVxufVxuIl19