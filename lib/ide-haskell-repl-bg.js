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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLWJnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFFYTtBQUViLG1FQUlnQztBQVVoQyxzQkFBOEIsU0FBUSwwQ0FBa0I7SUFFdEQsWUFBYSxVQUFxQyxFQUFFLEtBQWlCO1FBQ25FLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUE7SUFDMUIsQ0FBQztJQUVNLFVBQVUsQ0FBRSxHQUFXLEVBQUUsT0FBd0I7UUFDdEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUFDLE1BQU0sQ0FBQTtRQUFDLENBQUM7UUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7UUFDL0YsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQUMsTUFBTSxDQUFBO1FBQUMsQ0FBQztRQUN4QixNQUFNLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLEdBQUcsT0FBTyxDQUFBO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFBO1FBQ3ZDLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUMsQ0FBQTtJQUM5QyxDQUFDO0lBRVksT0FBTzs7O1lBQ2xCLGlCQUFhLFlBQUU7UUFDakIsQ0FBQztLQUFBO0lBRVksTUFBTTs7UUFFbkIsQ0FBQztLQUFBO0lBRWUsTUFBTTs7WUFDcEIsSUFBSSxDQUFDLFdBQVcsRUFBRyxDQUFBO1FBQ3JCLENBQUM7S0FBQTtJQUVlLGFBQWE7OztZQUMzQixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtZQUFDLENBQUM7WUFDeEQsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUE7WUFDdkMsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUE7WUFDdkIsTUFBTSxDQUFDLHVCQUFtQixZQUFFO1FBQzlCLENBQUM7S0FBQTtJQUVlLFdBQVc7O1lBQ3pCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO1lBQUMsQ0FBQztZQUN4RCxNQUFNLEVBQUMsTUFBTSxFQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUE7WUFDM0QsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUE7WUFDZixHQUFHLENBQUMsQ0FBQyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixNQUFNLEVBQUUsR0FBRyxnREFBZ0QsQ0FBQTtnQkFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQTtnQkFDNUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUNYLFFBQVEsQ0FBQTtnQkFDVixDQUFDO2dCQUNELE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ3hCLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDaEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUNqQixNQUFNLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtnQkFDdkYsTUFBTSxJQUFJLEdBQUcsWUFBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDdkUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUE7WUFDcEMsQ0FBQztZQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFBO1FBQ25CLENBQUM7S0FBQTtDQUNGO0FBckRELDRDQXFEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIFJhbmdlLFxufSBmcm9tICdhdG9tJ1xuXG5pbXBvcnQge1xuICBJQ29udGVudEl0ZW0sXG4gIElkZUhhc2tlbGxSZXBsQmFzZSxcbiAgSVZpZXdTdGF0ZSxcbn0gZnJvbSAnLi9pZGUtaGFza2VsbC1yZXBsLWJhc2UnXG5cbmV4cG9ydCB7SVZpZXdTdGF0ZSwgSUNvbnRlbnRJdGVtLCBJVHlwZVJlY29yZH1cblxuaW50ZXJmYWNlIElUeXBlUmVjb3JkIHtcbiAgdXJpOiBzdHJpbmdcbiAgdHlwZTogc3RyaW5nXG4gIHNwYW46IFJhbmdlXG59XG5cbmV4cG9ydCBjbGFzcyBJZGVIYXNrZWxsUmVwbEJnIGV4dGVuZHMgSWRlSGFza2VsbFJlcGxCYXNlIHtcbiAgcHJpdmF0ZSB0eXBlcz86IElUeXBlUmVjb3JkW11cbiAgY29uc3RydWN0b3IgKHVwaVByb21pc2U6IFByb21pc2U8VVBJLklVUElJbnN0YW5jZT4sIHN0YXRlOiBJVmlld1N0YXRlKSB7XG4gICAgc3VwZXIodXBpUHJvbWlzZSwgc3RhdGUpXG4gIH1cblxuICBwdWJsaWMgc2hvd1R5cGVBdCAodXJpOiBzdHJpbmcsIGlucmFuZ2U6IEF0b21UeXBlcy5SYW5nZSkge1xuICAgIGlmICghdGhpcy50eXBlcykgeyByZXR1cm4gfVxuICAgIGNvbnN0IHR5cGVSZWMgPSB0aGlzLnR5cGVzLmZpbmQoKHRyKSA9PiB0ciAmJiB0ci51cmkgPT09IHVyaSAmJiB0ci5zcGFuLmNvbnRhaW5zUmFuZ2UoaW5yYW5nZSkpXG4gICAgaWYgKCF0eXBlUmVjKSB7IHJldHVybiB9XG4gICAgY29uc3Qge3NwYW46IHJhbmdlLCB0eXBlOiB0ZXh0fSA9IHR5cGVSZWNcbiAgICBjb25zdCBoaWdobGlnaHRlciA9ICdoaW50LnR5cGUuaGFza2VsbCdcbiAgICByZXR1cm4geyByYW5nZSwgdGV4dDogeyB0ZXh0LCBoaWdobGlnaHRlciB9fVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGRlc3Ryb3kgKCkge1xuICAgIHN1cGVyLmRlc3Ryb3koKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHVwZGF0ZSAoKSB7XG4gICAgLy8gbm9vcFxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uTG9hZCAoKSB7XG4gICAgdGhpcy5nZXRBbGxUeXBlcyAoKVxuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIG9uSW5pdGlhbExvYWQgKCkge1xuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgYXdhaXQgdGhpcy5naGNpLndyaXRlTGluZXMoWyc6c2V0ICtjJ10pXG4gICAgYXdhaXQgdGhpcy5naGNpUmVsb2FkKClcbiAgICByZXR1cm4gc3VwZXIub25Jbml0aWFsTG9hZCgpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZ2V0QWxsVHlwZXMgKCk6IFByb21pc2U8SVR5cGVSZWNvcmRbXT4ge1xuICAgIGlmICghdGhpcy5naGNpKSB7IHRocm93IG5ldyBFcnJvcignTm8gR0hDSSBpbnN0YW5jZSEnKSB9XG4gICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhbJzphbGwtdHlwZXMnXSlcbiAgICB0aGlzLnR5cGVzID0gW11cbiAgICBmb3IgKGNvbnN0IGxpbmUgb2Ygc3Rkb3V0KSB7XG4gICAgICBjb25zdCByeCA9IC9eKC4qKTpcXCgoXFxkKyksKFxcZCspXFwpLVxcKChcXGQrKSwoXFxkKylcXCk6XFxzKiguKikkL1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKHJ4KVxuICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgY29uc3QgbSA9IG1hdGNoLnNsaWNlKDEpXG4gICAgICBjb25zdCB1cmkgPSBtWzBdXG4gICAgICBjb25zdCB0eXBlID0gbVs1XVxuICAgICAgY29uc3QgW3Jvd3N0YXJ0LCBjb2xzdGFydCwgcm93ZW5kLCBjb2xlbmRdID0gbS5zbGljZSgxKS5tYXAoKGkpID0+IHBhcnNlSW50KGksIDEwKSAtIDEpXG4gICAgICBjb25zdCBzcGFuID0gUmFuZ2UuZnJvbU9iamVjdChbW3Jvd3N0YXJ0LCBjb2xzdGFydF0sIFtyb3dlbmQsIGNvbGVuZF1dKVxuICAgICAgdGhpcy50eXBlcy5wdXNoKHt1cmksIHR5cGUsIHNwYW59KVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy50eXBlc1xuICB9XG59XG4iXX0=