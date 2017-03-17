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
            yield this.ghci.writeLines([':set +c']);
            yield this.ghciReload();
            return _super("onInitialLoad").call(this);
        });
    }
    getAllTypes() {
        return __awaiter(this, void 0, void 0, function* () {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLWJnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFFYTtBQUViLG1FQUlnQztBQVVoQyxzQkFBOEIsU0FBUSwwQ0FBa0I7SUFFdEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUMxQixDQUFDO0lBRU0sVUFBVSxDQUFFLEdBQVcsRUFBRSxPQUF3QjtRQUN0RCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTSxDQUFBO1FBQUMsQ0FBQztRQUMzQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUMvRixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFBQyxNQUFNLENBQUE7UUFBQyxDQUFDO1FBQ3hCLE1BQU0sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUMsR0FBRyxPQUFPLENBQUE7UUFDekMsTUFBTSxXQUFXLEdBQUcsbUJBQW1CLENBQUE7UUFDdkMsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBQyxDQUFBO0lBQzlDLENBQUM7SUFFWSxPQUFPOzs7WUFDbEIsaUJBQWEsV0FBRSxDQUFBO1FBQ2pCLENBQUM7S0FBQTtJQUVZLE1BQU07O1FBRW5CLENBQUM7S0FBQTtJQUVlLE1BQU07O1lBQ3BCLElBQUksQ0FBQyxXQUFXLEVBQUcsQ0FBQTtRQUNyQixDQUFDO0tBQUE7SUFFZSxhQUFhOzs7WUFDM0IsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUE7WUFDdkMsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUE7WUFDdkIsTUFBTSxDQUFDLHVCQUFtQixXQUFFLENBQUE7UUFDOUIsQ0FBQztLQUFBO0lBRWUsV0FBVzs7WUFDekIsTUFBTSxFQUFDLE1BQU0sRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFBO1lBQzNELElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFBO1lBQ2YsR0FBRyxDQUFDLENBQUMsTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDMUIsTUFBTSxFQUFFLEdBQUcsZ0RBQWdELENBQUE7Z0JBQzNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUE7Z0JBQzVCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDWCxRQUFRLENBQUE7Z0JBQ1YsQ0FBQztnQkFDRCxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUN4QixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ2hCLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDakIsTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7Z0JBQ3ZGLE1BQU0sSUFBSSxHQUFHLFlBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ3ZFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFBO1lBQ3BDLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQTtRQUNuQixDQUFDO0tBQUE7Q0FDRjtBQW5ERCw0Q0FtREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBSYW5nZSxcbn0gZnJvbSAnYXRvbSdcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbSwgSVR5cGVSZWNvcmR9XG5cbmludGVyZmFjZSBJVHlwZVJlY29yZCB7XG4gIHVyaTogc3RyaW5nXG4gIHR5cGU6IHN0cmluZ1xuICBzcGFuOiBSYW5nZVxufVxuXG5leHBvcnQgY2xhc3MgSWRlSGFza2VsbFJlcGxCZyBleHRlbmRzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHByaXZhdGUgdHlwZXM6IElUeXBlUmVjb3JkW11cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2UsIHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gICAgc3VwZXIodXBpUHJvbWlzZSwgc3RhdGUpXG4gIH1cblxuICBwdWJsaWMgc2hvd1R5cGVBdCAodXJpOiBzdHJpbmcsIGlucmFuZ2U6IEF0b21UeXBlcy5SYW5nZSkge1xuICAgIGlmICghdGhpcy50eXBlcykgeyByZXR1cm4gfVxuICAgIGNvbnN0IHR5cGVSZWMgPSB0aGlzLnR5cGVzLmZpbmQoKHRyKSA9PiB0ciAmJiB0ci51cmkgPT09IHVyaSAmJiB0ci5zcGFuLmNvbnRhaW5zUmFuZ2UoaW5yYW5nZSkpXG4gICAgaWYgKCF0eXBlUmVjKSB7IHJldHVybiB9XG4gICAgY29uc3Qge3NwYW46IHJhbmdlLCB0eXBlOiB0ZXh0fSA9IHR5cGVSZWNcbiAgICBjb25zdCBoaWdobGlnaHRlciA9ICdoaW50LnR5cGUuaGFza2VsbCdcbiAgICByZXR1cm4geyByYW5nZSwgdGV4dDogeyB0ZXh0LCBoaWdobGlnaHRlciB9fVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSAoKSB7XG4gICAgLy8gbm9vcFxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCAoKSB7XG4gICAgdGhpcy5nZXRBbGxUeXBlcyAoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKFsnOnNldCArYyddKVxuICAgIGF3YWl0IHRoaXMuZ2hjaVJlbG9hZCgpXG4gICAgcmV0dXJuIHN1cGVyLm9uSW5pdGlhbExvYWQoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEFsbFR5cGVzICgpOiBQcm9taXNlPElUeXBlUmVjb3JkW10+IHtcbiAgICBjb25zdCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKFsnOmFsbC10eXBlcyddKVxuICAgIHRoaXMudHlwZXMgPSBbXVxuICAgIGZvciAoY29uc3QgbGluZSBvZiBzdGRvdXQpIHtcbiAgICAgIGNvbnN0IHJ4ID0gL14oLiopOlxcKChcXGQrKSwoXFxkKylcXCktXFwoKFxcZCspLChcXGQrKVxcKTpcXHMqKC4qKSQvXG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2gocngpXG4gICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBjb25zdCBtID0gbWF0Y2guc2xpY2UoMSlcbiAgICAgIGNvbnN0IHVyaSA9IG1bMF1cbiAgICAgIGNvbnN0IHR5cGUgPSBtWzVdXG4gICAgICBjb25zdCBbcm93c3RhcnQsIGNvbHN0YXJ0LCByb3dlbmQsIGNvbGVuZF0gPSBtLnNsaWNlKDEpLm1hcCgoaSkgPT4gcGFyc2VJbnQoaSwgMTApIC0gMSlcbiAgICAgIGNvbnN0IHNwYW4gPSBSYW5nZS5mcm9tT2JqZWN0KFtbcm93c3RhcnQsIGNvbHN0YXJ0XSwgW3Jvd2VuZCwgY29sZW5kXV0pXG4gICAgICB0aGlzLnR5cGVzLnB1c2goe3VyaSwgdHlwZSwgc3Bhbn0pXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnR5cGVzXG4gIH1cbn1cbiJdfQ==