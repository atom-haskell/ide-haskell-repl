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
const ide_haskell_repl_base_1 = require("./ide-haskell-repl-base");
class IdeHaskellReplBg extends ide_haskell_repl_base_1.IdeHaskellReplBase {
    constructor(upiPromise, state) {
        super(upiPromise, state);
    }
    showTypeAt(uri, inrange) {
        if (!this.types) {
            return;
        }
        const typeRec = this.types.find((tr) => tr && tr.uri === uri && tr.span.containsRange(inrange));
        if (!typeRec) {
            return;
        }
        const { span: range, type: text } = typeRec;
        const highlighter = 'hint.type.haskell';
        return { range, text: { text, highlighter } };
    }
    destroy() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            _super("destroy").call(this);
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    onLoad() {
        return __awaiter(this, void 0, void 0, function* () {
            this.getAllTypes();
        });
    }
    onInitialLoad() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            yield this.ghci.writeLines([':set +c']);
            yield this.ghciReload();
            return _super("onInitialLoad").call(this);
        });
    }
    getAllTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.ghci) {
                throw new Error('No GHCI instance!');
            }
            const { stdout } = yield this.ghci.writeLines([':all-types']);
            this.types = [];
            for (const line of stdout) {
                const rx = /^(.*):\((\d+),(\d+)\)-\((\d+),(\d+)\):\s*(.*)$/;
                const match = line.match(rx);
                if (!match) {
                    continue;
                }
                const m = match.slice(1);
                const uri = m[0];
                const type = m[5];
                const [rowstart, colstart, rowend, colend] = m.slice(1).map((i) => parseInt(i, 10) - 1);
                const span = atom_1.Range.fromObject([[rowstart, colstart], [rowend, colend]]);
                this.types.push({ uri, type, span });
            }
            return this.types;
        });
    }
}
exports.IdeHaskellReplBg = IdeHaskellReplBg;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLWJnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFFYTtBQUViLG1FQUlnQztBQVVoQyxzQkFBOEIsU0FBUSwwQ0FBa0I7SUFFdEQsWUFBYSxVQUFxQyxFQUFFLEtBQWlCO1FBQ25FLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFDMUIsQ0FBQztJQUVNLFVBQVUsQ0FBRSxHQUFXLEVBQUUsT0FBd0I7UUFDdEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU0sQ0FBQTtRQUFDLENBQUM7UUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7UUFDL0YsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTSxDQUFBO1FBQUMsQ0FBQztRQUN4QixNQUFNLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLEdBQUcsT0FBTyxDQUFBO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFBO1FBQ3ZDLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUMsQ0FBQTtJQUM5QyxDQUFDO0lBRVksT0FBTzs7O1lBQ2xCLGlCQUFhLFdBQUUsQ0FBQTtRQUNqQixDQUFDO0tBQUE7SUFFWSxNQUFNOztRQUVuQixDQUFDO0tBQUE7SUFFZSxNQUFNOztZQUNwQixJQUFJLENBQUMsV0FBVyxFQUFHLENBQUE7UUFDckIsQ0FBQztLQUFBO0lBRWUsYUFBYTs7O1lBQzNCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO1lBQUMsQ0FBQztZQUN4RCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQTtZQUN2QyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtZQUN2QixNQUFNLENBQUMsdUJBQW1CLFdBQUUsQ0FBQTtRQUM5QixDQUFDO0tBQUE7SUFFZSxXQUFXOztZQUN6QixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtZQUFDLENBQUM7WUFDeEQsTUFBTSxFQUFDLE1BQU0sRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFBO1lBQzNELElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFBO1lBQ2YsR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDMUIsTUFBTSxFQUFFLEdBQUcsZ0RBQWdELENBQUE7Z0JBQzNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUE7Z0JBQzVCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDWCxRQUFRLENBQUE7Z0JBQ1YsQ0FBQztnQkFDRCxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUN4QixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ2hCLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDakIsTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7Z0JBQ3ZGLE1BQU0sSUFBSSxHQUFHLFlBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ3ZFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFBO1lBQ3BDLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQTtRQUNuQixDQUFDO0tBQUE7Q0FDRjtBQXJERCw0Q0FxREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBSYW5nZSxcbn0gZnJvbSAnYXRvbSdcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbSwgSVR5cGVSZWNvcmR9XG5cbmludGVyZmFjZSBJVHlwZVJlY29yZCB7XG4gIHVyaTogc3RyaW5nXG4gIHR5cGU6IHN0cmluZ1xuICBzcGFuOiBSYW5nZVxufVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxCZyBleHRlbmRzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHByaXZhdGUgdHlwZXM/OiBJVHlwZVJlY29yZFtdXG4gIGNvbnN0cnVjdG9yICh1cGlQcm9taXNlOiBQcm9taXNlPFVQSS5JVVBJSW5zdGFuY2U+LCBzdGF0ZTogSVZpZXdTdGF0ZSkge1xuICAgIHN1cGVyKHVwaVByb21pc2UsIHN0YXRlKVxuICB9XG5cbiAgcHVibGljIHNob3dUeXBlQXQgKHVyaTogc3RyaW5nLCBpbnJhbmdlOiBBdG9tVHlwZXMuUmFuZ2UpIHtcbiAgICBpZiAoIXRoaXMudHlwZXMpIHsgcmV0dXJuIH1cbiAgICBjb25zdCB0eXBlUmVjID0gdGhpcy50eXBlcy5maW5kKCh0cikgPT4gdHIgJiYgdHIudXJpID09PSB1cmkgJiYgdHIuc3Bhbi5jb250YWluc1JhbmdlKGlucmFuZ2UpKVxuICAgIGlmICghdHlwZVJlYykgeyByZXR1cm4gfVxuICAgIGNvbnN0IHtzcGFuOiByYW5nZSwgdHlwZTogdGV4dH0gPSB0eXBlUmVjXG4gICAgY29uc3QgaGlnaGxpZ2h0ZXIgPSAnaGludC50eXBlLmhhc2tlbGwnXG4gICAgcmV0dXJuIHsgcmFuZ2UsIHRleHQ6IHsgdGV4dCwgaGlnaGxpZ2h0ZXIgfX1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBzdXBlci5kZXN0cm95KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIHRoaXMuZ2V0QWxsVHlwZXMgKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKFsnOnNldCArYyddKVxuICAgIGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpXG4gICAgcmV0dXJuIHN1cGVyLm9uSW5pdGlhbExvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEFsbFR5cGVzICgpOiBQcm9taXNlPElUeXBlUmVjb3JkW10+IHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoWyc6YWxsLXR5cGVzJ10pXG4gICAgdGhpcy50eXBlcyA9IFtdXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIHN0ZG91dCkge1xuICAgICAgY29uc3QgcnggPSAvXiguKik6XFwoKFxcZCspLChcXGQrKVxcKS1cXCgoXFxkKyksKFxcZCspXFwpOlxccyooLiopJC9cbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaChyeClcbiAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIGNvbnN0IG0gPSBtYXRjaC5zbGljZSgxKVxuICAgICAgY29uc3QgdXJpID0gbVswXVxuICAgICAgY29uc3QgdHlwZSA9IG1bNV1cbiAgICAgIGNvbnN0IFtyb3dzdGFydCwgY29sc3RhcnQsIHJvd2VuZCwgY29sZW5kXSA9IG0uc2xpY2UoMSkubWFwKChpKSA9PiBwYXJzZUludChpLCAxMCkgLSAxKVxuICAgICAgY29uc3Qgc3BhbiA9IFJhbmdlLmZyb21PYmplY3QoW1tyb3dzdGFydCwgY29sc3RhcnRdLCBbcm93ZW5kLCBjb2xlbmRdXSlcbiAgICAgIHRoaXMudHlwZXMucHVzaCh7dXJpLCB0eXBlLCBzcGFufSlcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudHlwZXNcbiAgfVxufVxuIl19