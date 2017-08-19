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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFXN0I7SUFPRSxZQUFtQixLQUFhO1FBQWIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUM5QixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUE7UUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUMvQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDMUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPO1lBQ3pCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTztZQUNyQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsTUFBTTtTQUM5QixDQUFDLENBQUMsQ0FBQTtJQUNMLENBQUM7SUFFTSxNQUFNO1FBQ1gsTUFBTSxDQUFDLENBQ0wscUJBQ0UsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDckQsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQ3BDLENBQ0gsQ0FBQTtJQUNILENBQUM7SUFFWSxPQUFPOztZQUNsQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDeEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUE7WUFDckIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQTtRQUM1QixDQUFDO0tBQUE7SUFFWSxNQUFNLENBQUMsS0FBYTs7WUFDL0IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQTtZQUM5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBO1lBQzVCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtZQUMvQixDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDMUIsQ0FBQztLQUFBO0lBRU0sS0FBSztRQUNWLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUN6RCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBcERELHdCQW9EQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJ1xuaW1wb3J0IGV0Y2ggPSByZXF1aXJlKCdldGNoJylcbmltcG9ydCB7IElkZUhhc2tlbGxSZXBsVmlldyB9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5pbnRlcmZhY2UgSVByb3BzIGV4dGVuZHMgSlNYLlByb3BzIHtcbiAgY2xzOiBzdHJpbmdcbiAgcGFyZW50OiBJZGVIYXNrZWxsUmVwbFZpZXdcbiAgdG9vbHRpcDogc3RyaW5nIHwgKCgpID0+IHN0cmluZylcbiAgY29tbWFuZDogc3RyaW5nXG4gIHN0YXRlPzogYm9vbGVhblxufVxuXG5leHBvcnQgY2xhc3MgQnV0dG9uIGltcGxlbWVudHMgSlNYLkVsZW1lbnRDbGFzcyB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkXG4gIHByaXZhdGUgZWxlbWVudDogSFRNTEVsZW1lbnRcbiAgcHJpdmF0ZSB0YXJnZXQ6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgZGVzdHJveWVkOiBib29sZWFuXG4gIHByaXZhdGUgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGVcbiAgcHJpdmF0ZSBjbHNsc3Q6IFNldDxzdHJpbmc+XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwcm9wczogSVByb3BzKSB7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG4gICAgdGhpcy5jbHNsc3QgPSBuZXcgU2V0KClcbiAgICB0aGlzLmNsc2xzdC5hZGQodGhpcy5wcm9wcy5jbHMpXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gICAgdGhpcy50YXJnZXQgPSBhdG9tLnZpZXdzLmdldFZpZXcodGhpcy5wcm9wcy5wYXJlbnQuZWRpdG9yKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20udG9vbHRpcHMuYWRkKHRoaXMuZWxlbWVudCwge1xuICAgICAgdGl0bGU6IHRoaXMucHJvcHMudG9vbHRpcCxcbiAgICAgIGtleUJpbmRpbmdDb21tYW5kOiB0aGlzLnByb3BzLmNvbW1hbmQsXG4gICAgICBrZXlCaW5kaW5nVGFyZ2V0OiB0aGlzLnRhcmdldCxcbiAgICB9KSlcbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxidXR0b25cbiAgICAgICAgY2xhc3NOYW1lPXtBcnJheS5mcm9tKHRoaXMuY2xzbHN0LnZhbHVlcygpKS5qb2luKCcgJyl9XG4gICAgICAgIG9uPXt7IGNsaWNrOiB0aGlzLmNsaWNrLmJpbmQodGhpcykgfX1cbiAgICAgIC8+XG4gICAgKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3koKSB7XG4gICAgYXdhaXQgZXRjaC5kZXN0cm95KHRoaXMpXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUocHJvcHM6IElQcm9wcykge1xuICAgIGlmICh0aGlzLnByb3BzLnN0YXRlID09PSBwcm9wcy5zdGF0ZSkgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkgfVxuICAgIHRoaXMucHJvcHMuc3RhdGUgPSBwcm9wcy5zdGF0ZVxuICAgIGlmICh0aGlzLnByb3BzLnN0YXRlKSB7XG4gICAgICB0aGlzLmNsc2xzdC5hZGQoJ2VuYWJsZWQnKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNsc2xzdC5kZWxldGUoJ2VuYWJsZWQnKVxuICAgIH1cbiAgICByZXR1cm4gZXRjaC51cGRhdGUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBjbGljaygpIHtcbiAgICBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgIGF0b20uY29tbWFuZHMuZGlzcGF0Y2godGhpcy50YXJnZXQsIHRoaXMucHJvcHMuY29tbWFuZClcbiAgICB9XG4gIH1cbn1cbiJdfQ==