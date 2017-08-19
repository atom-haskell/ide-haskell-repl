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
            return undefined;
        }
        const typeRec = this.types.find((tr) => tr && tr.uri === uri && tr.span.containsRange(inrange));
        if (!typeRec) {
            return undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLWJnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFFYTtBQUViLG1FQUlnQztBQVVoQyxzQkFBOEIsU0FBUSwwQ0FBa0I7SUFFdEQsWUFBYSxVQUFxQyxFQUFFLEtBQWlCO1FBQ25FLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFDMUIsQ0FBQztJQUVNLFVBQVUsQ0FBRSxHQUFXLEVBQUUsT0FBd0I7UUFDdEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUE7UUFBQyxDQUFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBO1FBQy9GLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUE7UUFBQyxDQUFDO1FBQ2xDLE1BQU0sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUMsR0FBRyxPQUFPLENBQUE7UUFDekMsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUE7UUFDdkMsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBQyxDQUFBO0lBQzlDLENBQUM7SUFFWSxPQUFPOzs7WUFDbEIsaUJBQWEsWUFBRTtRQUNqQixDQUFDO0tBQUE7SUFFWSxNQUFNOztRQUVuQixDQUFDO0tBQUE7SUFFZSxNQUFNOztZQUNwQixJQUFJLENBQUMsV0FBVyxFQUFHLENBQUE7UUFDckIsQ0FBQztLQUFBO0lBRWUsYUFBYTs7O1lBQzNCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO1lBQUMsQ0FBQztZQUN4RCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQTtZQUN2QyxNQUFNLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtZQUN2QixNQUFNLENBQUMsdUJBQW1CLFlBQUU7UUFDOUIsQ0FBQztLQUFBO0lBRWUsV0FBVzs7WUFDekIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFBQyxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixDQUFDLENBQUE7WUFBQyxDQUFDO1lBQ3hELE1BQU0sRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQTtZQUMzRCxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQTtZQUNmLEdBQUcsQ0FBQyxDQUFDLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQzFCLE1BQU0sRUFBRSxHQUFHLGdEQUFnRCxDQUFBO2dCQUMzRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFBO2dCQUM1QixFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1gsUUFBUSxDQUFBO2dCQUNWLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDeEIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUNoQixNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ2pCLE1BQU0sQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO2dCQUN2RixNQUFNLElBQUksR0FBRyxZQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUN2RSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQTtZQUNwQyxDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUE7UUFDbkIsQ0FBQztLQUFBO0NBQ0Y7QUFyREQsNENBcURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgUmFuZ2UsXG59IGZyb20gJ2F0b20nXG5cbmltcG9ydCB7XG4gIElDb250ZW50SXRlbSxcbiAgSWRlSGFza2VsbFJlcGxCYXNlLFxuICBJVmlld1N0YXRlLFxufSBmcm9tICcuL2lkZS1oYXNrZWxsLXJlcGwtYmFzZSdcblxuZXhwb3J0IHtJVmlld1N0YXRlLCBJQ29udGVudEl0ZW19XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVR5cGVSZWNvcmQge1xuICB1cmk6IHN0cmluZ1xuICB0eXBlOiBzdHJpbmdcbiAgc3BhbjogUmFuZ2Vcbn1cblxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwcml2YXRlIHR5cGVzPzogSVR5cGVSZWNvcmRbXVxuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZTogUHJvbWlzZTxVUEkuSVVQSUluc3RhbmNlPiwgc3RhdGU6IElWaWV3U3RhdGUpIHtcbiAgICBzdXBlcih1cGlQcm9taXNlLCBzdGF0ZSlcbiAgfVxuXG4gIHB1YmxpYyBzaG93VHlwZUF0ICh1cmk6IHN0cmluZywgaW5yYW5nZTogQXRvbVR5cGVzLlJhbmdlKSB7XG4gICAgaWYgKCF0aGlzLnR5cGVzKSB7IHJldHVybiB1bmRlZmluZWQgfVxuICAgIGNvbnN0IHR5cGVSZWMgPSB0aGlzLnR5cGVzLmZpbmQoKHRyKSA9PiB0ciAmJiB0ci51cmkgPT09IHVyaSAmJiB0ci5zcGFuLmNvbnRhaW5zUmFuZ2UoaW5yYW5nZSkpXG4gICAgaWYgKCF0eXBlUmVjKSB7IHJldHVybiB1bmRlZmluZWQgfVxuICAgIGNvbnN0IHtzcGFuOiByYW5nZSwgdHlwZTogdGV4dH0gPSB0eXBlUmVjXG4gICAgY29uc3QgaGlnaGxpZ2h0ZXIgPSAnaGludC50eXBlLmhhc2tlbGwnXG4gICAgcmV0dXJuIHsgcmFuZ2UsIHRleHQ6IHsgdGV4dCwgaGlnaGxpZ2h0ZXIgfX1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBkZXN0cm95ICgpIHtcbiAgICBzdXBlci5kZXN0cm95KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIHRoaXMuZ2V0QWxsVHlwZXMgKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKFsnOnNldCArYyddKVxuICAgIGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpXG4gICAgcmV0dXJuIHN1cGVyLm9uSW5pdGlhbExvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEFsbFR5cGVzICgpOiBQcm9taXNlPElUeXBlUmVjb3JkW10+IHtcbiAgICBpZiAoIXRoaXMuZ2hjaSkgeyB0aHJvdyBuZXcgRXJyb3IoJ05vIEdIQ0kgaW5zdGFuY2UhJykgfVxuICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoWyc6YWxsLXR5cGVzJ10pXG4gICAgdGhpcy50eXBlcyA9IFtdXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIHN0ZG91dCkge1xuICAgICAgY29uc3QgcnggPSAvXiguKik6XFwoKFxcZCspLChcXGQrKVxcKS1cXCgoXFxkKyksKFxcZCspXFwpOlxccyooLiopJC9cbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaChyeClcbiAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIGNvbnN0IG0gPSBtYXRjaC5zbGljZSgxKVxuICAgICAgY29uc3QgdXJpID0gbVswXVxuICAgICAgY29uc3QgdHlwZSA9IG1bNV1cbiAgICAgIGNvbnN0IFtyb3dzdGFydCwgY29sc3RhcnQsIHJvd2VuZCwgY29sZW5kXSA9IG0uc2xpY2UoMSkubWFwKChpKSA9PiBwYXJzZUludChpLCAxMCkgLSAxKVxuICAgICAgY29uc3Qgc3BhbiA9IFJhbmdlLmZyb21PYmplY3QoW1tyb3dzdGFydCwgY29sc3RhcnRdLCBbcm93ZW5kLCBjb2xlbmRdXSlcbiAgICAgIHRoaXMudHlwZXMucHVzaCh7dXJpLCB0eXBlLCBzcGFufSlcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudHlwZXNcbiAgfVxufVxuIl19