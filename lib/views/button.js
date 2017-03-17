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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFRMUIsQ0FBQztBQUVKO0lBT0UsWUFBYSxLQUFhO1FBQ3hCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFBO1FBQ2xCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO1FBQzVDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQy9CLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFBO1FBQzlDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDbkQsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTztZQUN6QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU87WUFDckMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDOUIsQ0FBQyxDQUFDLENBQUE7SUFDTCxDQUFDO0lBRU0sTUFBTTtRQUNYLE1BQU0sQ0FBQyxDQUNMLHFCQUNFLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQ3JELEVBQUUsRUFBRSxFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFJLENBQ3pDLENBQUE7SUFDSCxDQUFDO0lBRVksT0FBTzs7WUFDbEIsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ3hCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFBO1lBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUE7UUFDNUIsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFFLEVBQUMsS0FBSyxFQUFDO1FBQ3BCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDVixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUM1QixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUMvQixDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUNuQixDQUFDO0lBRU0sS0FBSztRQUNWLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUN6RCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBbERELHdCQWtEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJ1xuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcbmltcG9ydCB7SWRlSGFza2VsbFJlcGxWaWV3fSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtdmlldydcblxuaW50ZXJmYWNlIElQcm9wcyB7XG4gICAgY2xzOiBzdHJpbmdcbiAgICBwYXJlbnQ6IElkZUhhc2tlbGxSZXBsVmlld1xuICAgIHRvb2x0aXA6IHN0cmluZyB8ICgoKSA9PiBTdHJpbmcpXG4gICAgY29tbWFuZDogc3RyaW5nXG4gIH07XG5cbmV4cG9ydCBjbGFzcyBCdXR0b24ge1xuICBwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgdGFyZ2V0OiBIVE1MRWxlbWVudFxuICBwcml2YXRlIHByb3BzOiBJUHJvcHNcbiAgcHJpdmF0ZSBkZXN0cm95ZWQ6IGJvb2xlYW5cbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogYW55XG4gIHByaXZhdGUgY2xzbHN0OiBTZXQ8YW55PlxuICBjb25zdHJ1Y3RvciAocHJvcHM6IElQcm9wcykge1xuICAgIHRoaXMucHJvcHMgPSBwcm9wc1xuICAgIHRoaXMuZGVzdHJveWVkID0gZmFsc2VcbiAgICB0aGlzLmRpc3Bvc2FibGVzID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuICAgIHRoaXMuY2xzbHN0ID0gbmV3IFNldCgpXG4gICAgdGhpcy5jbHNsc3QuYWRkKHRoaXMucHJvcHMuY2xzKVxuICAgIGV0Y2guaW5pdGlhbGl6ZSh0aGlzKVxuICAgIHRoaXMudGFyZ2V0ID0gdGhpcy5wcm9wcy5wYXJlbnQuZWRpdG9yLmVsZW1lbnRcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmFkZChhdG9tLnRvb2x0aXBzLmFkZCh0aGlzLmVsZW1lbnQsIHtcbiAgICAgIHRpdGxlOiB0aGlzLnByb3BzLnRvb2x0aXAsXG4gICAgICBrZXlCaW5kaW5nQ29tbWFuZDogdGhpcy5wcm9wcy5jb21tYW5kLFxuICAgICAga2V5QmluZGluZ1RhcmdldDogdGhpcy50YXJnZXQsXG4gICAgfSkpXG4gIH1cblxuICBwdWJsaWMgcmVuZGVyICgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGJ1dHRvblxuICAgICAgICBjbGFzc05hbWU9e0FycmF5LmZyb20odGhpcy5jbHNsc3QudmFsdWVzKCkpLmpvaW4oJyAnKX1cbiAgICAgICAgb249e3tjbGljazogdGhpcy5jbGljay5iaW5kKHRoaXMpfX0gLz5cbiAgICApXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgYXdhaXQgZXRjaC5kZXN0cm95KHRoaXMpXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgfVxuXG4gIHB1YmxpYyB1cGRhdGUgKHtzdGF0ZX0pIHtcbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgIHRoaXMuY2xzbHN0LmFkZCgnZW5hYmxlZCcpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2xzbHN0LmRlbGV0ZSgnZW5hYmxlZCcpXG4gICAgfVxuICAgIGV0Y2gudXBkYXRlKHRoaXMpXG4gIH1cblxuICBwdWJsaWMgY2xpY2sgKCkge1xuICAgIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgYXRvbS5jb21tYW5kcy5kaXNwYXRjaCh0aGlzLnRhcmdldCwgdGhpcy5wcm9wcy5jb21tYW5kKVxuICAgIH1cbiAgfVxufVxuIl19