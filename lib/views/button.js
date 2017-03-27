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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFRMUIsQ0FBQztBQUVKO0lBUUUsWUFBYSxLQUFhO1FBQ3hCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFBO1FBQ2xCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSwwQkFBbUIsRUFBRSxDQUFBO1FBQzVDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQy9CLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFBO1FBQzlDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDbkQsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTztZQUN6QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU87WUFDckMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDOUIsQ0FBQyxDQUFDLENBQUE7SUFDTCxDQUFDO0lBRU0sTUFBTTtRQUNYLE1BQU0sQ0FBQyxDQUNMLHFCQUNFLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQ3JELEVBQUUsRUFBRSxFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFJLENBQ3pDLENBQUE7SUFDSCxDQUFDO0lBRVksT0FBTzs7WUFDbEIsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ3hCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFBO1lBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUE7UUFDNUIsQ0FBQztLQUFBO0lBRU0sTUFBTSxDQUFFLEVBQUMsS0FBSyxFQUFtQjtRQUN0QyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUE7UUFDNUIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUE7UUFDL0IsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDbkIsQ0FBQztJQUVNLEtBQUs7UUFDVixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNoQixJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDekQsQ0FBQztJQUNILENBQUM7Q0FDRjtBQW5ERCx3QkFtREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb3NpdGVEaXNwb3NhYmxlIH0gZnJvbSAnYXRvbSdcbmltcG9ydCBldGNoID0gcmVxdWlyZSgnZXRjaCcpXG5pbXBvcnQge0lkZUhhc2tlbGxSZXBsVmlld30gZnJvbSAnLi9pZGUtaGFza2VsbC1yZXBsLXZpZXcnXG5cbmludGVyZmFjZSBJUHJvcHMge1xuICAgIGNsczogc3RyaW5nXG4gICAgcGFyZW50OiBJZGVIYXNrZWxsUmVwbFZpZXdcbiAgICB0b29sdGlwOiBzdHJpbmcgfCAoKCkgPT4gU3RyaW5nKVxuICAgIGNvbW1hbmQ6IHN0cmluZ1xuICB9O1xuXG5leHBvcnQgY2xhc3MgQnV0dG9uIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgdGFyZ2V0OiBIVE1MRWxlbWVudFxuICBwcml2YXRlIHByb3BzOiBJUHJvcHNcbiAgcHJpdmF0ZSBkZXN0cm95ZWQ6IGJvb2xlYW5cbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuICBwcml2YXRlIGNsc2xzdDogU2V0PHN0cmluZz5cbiAgY29uc3RydWN0b3IgKHByb3BzOiBJUHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHNcbiAgICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlXG4gICAgdGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcbiAgICB0aGlzLmNsc2xzdCA9IG5ldyBTZXQoKVxuICAgIHRoaXMuY2xzbHN0LmFkZCh0aGlzLnByb3BzLmNscylcbiAgICBldGNoLmluaXRpYWxpemUodGhpcylcbiAgICB0aGlzLnRhcmdldCA9IHRoaXMucHJvcHMucGFyZW50LmVkaXRvci5lbGVtZW50XG4gICAgdGhpcy5kaXNwb3NhYmxlcy5hZGQoYXRvbS50b29sdGlwcy5hZGQodGhpcy5lbGVtZW50LCB7XG4gICAgICB0aXRsZTogdGhpcy5wcm9wcy50b29sdGlwLFxuICAgICAga2V5QmluZGluZ0NvbW1hbmQ6IHRoaXMucHJvcHMuY29tbWFuZCxcbiAgICAgIGtleUJpbmRpbmdUYXJnZXQ6IHRoaXMudGFyZ2V0LFxuICAgIH0pKVxuICB9XG5cbiAgcHVibGljIHJlbmRlciAoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxidXR0b25cbiAgICAgICAgY2xhc3NOYW1lPXtBcnJheS5mcm9tKHRoaXMuY2xzbHN0LnZhbHVlcygpKS5qb2luKCcgJyl9XG4gICAgICAgIG9uPXt7Y2xpY2s6IHRoaXMuY2xpY2suYmluZCh0aGlzKX19IC8+XG4gICAgKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIGF3YWl0IGV0Y2guZGVzdHJveSh0aGlzKVxuICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG4gIH1cblxuICBwdWJsaWMgdXBkYXRlICh7c3RhdGV9OiB7c3RhdGU6IGJvb2xlYW59KSB7XG4gICAgaWYgKHN0YXRlKSB7XG4gICAgICB0aGlzLmNsc2xzdC5hZGQoJ2VuYWJsZWQnKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNsc2xzdC5kZWxldGUoJ2VuYWJsZWQnKVxuICAgIH1cbiAgICBldGNoLnVwZGF0ZSh0aGlzKVxuICB9XG5cbiAgcHVibGljIGNsaWNrICgpIHtcbiAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgIGF0b20uY29tbWFuZHMuZGlzcGF0Y2godGhpcy50YXJnZXQsIHRoaXMucHJvcHMuY29tbWFuZClcbiAgICB9XG4gIH1cbn1cbiJdfQ==