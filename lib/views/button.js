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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnV0dG9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3ZpZXdzL2J1dHRvbi50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLCtCQUEwQztBQUMxQyw2QkFBNkI7QUFXN0I7SUFPRSxZQUFvQixLQUFhO1FBQWIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUMvQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQTtRQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtRQUM1QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUE7UUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUMvQixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQTtRQUM5QyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ25ELEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU87WUFDekIsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPO1lBQ3JDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxNQUFNO1NBQzlCLENBQUMsQ0FBQyxDQUFBO0lBQ0wsQ0FBQztJQUVNLE1BQU07UUFDWCxNQUFNLENBQUMsQ0FDTCxxQkFDRSxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUNyRCxFQUFFLEVBQUUsRUFBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBSSxDQUN6QyxDQUFBO0lBQ0gsQ0FBQztJQUVZLE9BQU87O1lBQ2xCLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUN4QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQTtZQUNyQixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBQzVCLENBQUM7S0FBQTtJQUVZLE1BQU0sQ0FBRSxLQUFhOztZQUNoQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFBO1lBQUMsQ0FBQztZQUNsRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFBO1lBQzlCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDckIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUE7WUFDNUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1lBQy9CLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUMxQixDQUFDO0tBQUE7SUFFTSxLQUFLO1FBQ1YsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBQ3pELENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFuREQsd0JBbURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9zaXRlRGlzcG9zYWJsZSB9IGZyb20gJ2F0b20nXG5pbXBvcnQgZXRjaCA9IHJlcXVpcmUoJ2V0Y2gnKVxuaW1wb3J0IHtJZGVIYXNrZWxsUmVwbFZpZXd9IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC12aWV3J1xuXG5pbnRlcmZhY2UgSVByb3BzIGV4dGVuZHMgSlNYLlByb3BzIHtcbiAgICBjbHM6IHN0cmluZ1xuICAgIHBhcmVudDogSWRlSGFza2VsbFJlcGxWaWV3XG4gICAgdG9vbHRpcDogc3RyaW5nIHwgKCgpID0+IHN0cmluZylcbiAgICBjb21tYW5kOiBzdHJpbmdcbiAgICBzdGF0ZT86IGJvb2xlYW5cbiAgfVxuXG5leHBvcnQgY2xhc3MgQnV0dG9uIGltcGxlbWVudHMgSlNYLkVsZW1lbnRDbGFzcyB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBlbGVtZW50OiBIVE1MRWxlbWVudFxuICBwcml2YXRlIHRhcmdldDogSFRNTEVsZW1lbnRcbiAgcHJpdmF0ZSBkZXN0cm95ZWQ6IGJvb2xlYW5cbiAgcHJpdmF0ZSBkaXNwb3NhYmxlczogQ29tcG9zaXRlRGlzcG9zYWJsZVxuICBwcml2YXRlIGNsc2xzdDogU2V0PHN0cmluZz5cbiAgY29uc3RydWN0b3IgKHB1YmxpYyBwcm9wczogSVByb3BzKSB7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG4gICAgdGhpcy5jbHNsc3QgPSBuZXcgU2V0KClcbiAgICB0aGlzLmNsc2xzdC5hZGQodGhpcy5wcm9wcy5jbHMpXG4gICAgZXRjaC5pbml0aWFsaXplKHRoaXMpXG4gICAgdGhpcy50YXJnZXQgPSB0aGlzLnByb3BzLnBhcmVudC5lZGl0b3IuZWxlbWVudFxuICAgIHRoaXMuZGlzcG9zYWJsZXMuYWRkKGF0b20udG9vbHRpcHMuYWRkKHRoaXMuZWxlbWVudCwge1xuICAgICAgdGl0bGU6IHRoaXMucHJvcHMudG9vbHRpcCxcbiAgICAgIGtleUJpbmRpbmdDb21tYW5kOiB0aGlzLnByb3BzLmNvbW1hbmQsXG4gICAgICBrZXlCaW5kaW5nVGFyZ2V0OiB0aGlzLnRhcmdldCxcbiAgICB9KSlcbiAgfVxuXG4gIHB1YmxpYyByZW5kZXIgKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8YnV0dG9uXG4gICAgICAgIGNsYXNzTmFtZT17QXJyYXkuZnJvbSh0aGlzLmNsc2xzdC52YWx1ZXMoKSkuam9pbignICcpfVxuICAgICAgICBvbj17e2NsaWNrOiB0aGlzLmNsaWNrLmJpbmQodGhpcyl9fSAvPlxuICAgIClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBhd2FpdCBldGNoLmRlc3Ryb3kodGhpcylcbiAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWVcbiAgICB0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSAocHJvcHM6IElQcm9wcykge1xuICAgIGlmICh0aGlzLnByb3BzLnN0YXRlID09PSBwcm9wcy5zdGF0ZSkgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkgfVxuICAgIHRoaXMucHJvcHMuc3RhdGUgPSBwcm9wcy5zdGF0ZVxuICAgIGlmICh0aGlzLnByb3BzLnN0YXRlKSB7XG4gICAgICB0aGlzLmNsc2xzdC5hZGQoJ2VuYWJsZWQnKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNsc2xzdC5kZWxldGUoJ2VuYWJsZWQnKVxuICAgIH1cbiAgICByZXR1cm4gZXRjaC51cGRhdGUodGhpcylcbiAgfVxuXG4gIHB1YmxpYyBjbGljayAoKSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICBhdG9tLmNvbW1hbmRzLmRpc3BhdGNoKHRoaXMudGFyZ2V0LCB0aGlzLnByb3BzLmNvbW1hbmQpXG4gICAgfVxuICB9XG59XG4iXX0=