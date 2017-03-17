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
        this.disposables = new atom_1.CompositeDisposable();
    }
    destroy() {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            this.disposables.dispose();
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
}
exports.IdeHaskellReplBg = IdeHaskellReplBg;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pZGUtaGFza2VsbC1yZXBsLWJnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFFYTtBQUViLG1FQUlnQztBQUloQyxzQkFBOEIsU0FBUSwwQ0FBa0I7SUFFdEQsWUFBYSxVQUFVLEVBQUUsS0FBaUI7UUFDeEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN4QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksMEJBQW1CLEVBQUUsQ0FBQTtJQUM5QyxDQUFDO0lBRVksT0FBTzs7O1lBQ2xCLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUE7WUFDMUIsaUJBQWEsV0FBRSxDQUFBO1FBQ2pCLENBQUM7S0FBQTtJQUVZLE1BQU07O1FBRW5CLENBQUM7S0FBQTtJQUVlLE1BQU07O1lBQ3BCLElBQUksQ0FBQyxXQUFXLEVBQUcsQ0FBQTtRQUNyQixDQUFDO0tBQUE7SUFFZSxhQUFhOzs7WUFDM0IsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUE7WUFDdkMsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUE7WUFDdkIsTUFBTSxDQUFDLHVCQUFtQixXQUFFLENBQUE7UUFDOUIsQ0FBQztLQUFBO0NBQ0Y7QUF6QkQsNENBeUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQ29tcG9zaXRlRGlzcG9zYWJsZSxcbn0gZnJvbSAnYXRvbSdcblxuaW1wb3J0IHtcbiAgSUNvbnRlbnRJdGVtLFxuICBJZGVIYXNrZWxsUmVwbEJhc2UsXG4gIElWaWV3U3RhdGUsXG59IGZyb20gJy4vaWRlLWhhc2tlbGwtcmVwbC1iYXNlJ1xuXG5leHBvcnQge0lWaWV3U3RhdGUsIElDb250ZW50SXRlbX1cblxuZXhwb3J0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmcgZXh0ZW5kcyBJZGVIYXNrZWxsUmVwbEJhc2Uge1xuICBwcml2YXRlIGRpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlXG4gIGNvbnN0cnVjdG9yICh1cGlQcm9taXNlLCBzdGF0ZTogSVZpZXdTdGF0ZSkge1xuICAgIHN1cGVyKHVwaVByb21pc2UsIHN0YXRlKVxuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKClcbiAgICBzdXBlci5kZXN0cm95KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB1cGRhdGUgKCkge1xuICAgIC8vIG5vb3BcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkxvYWQgKCkge1xuICAgIHRoaXMuZ2V0QWxsVHlwZXMgKClcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBvbkluaXRpYWxMb2FkICgpIHtcbiAgICBhd2FpdCB0aGlzLmdoY2kud3JpdGVMaW5lcyhbJzpzZXQgK2MnXSlcbiAgICBhd2FpdCB0aGlzLmdoY2lSZWxvYWQoKVxuICAgIHJldHVybiBzdXBlci5vbkluaXRpYWxMb2FkKClcbiAgfVxufVxuIl19