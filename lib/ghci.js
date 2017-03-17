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
const atom_haskell_utils_1 = require("atom-haskell-utils");
const os_1 = require("os");
const interactive_process_1 = require("./interactive-process");
class GHCI {
    constructor(opts) {
        let endPattern = /^#~IDEHASKELLREPL~(.*)~#$/;
        let { cwd, atomPath, command, args, onExit } = opts;
        this.onDidExit = onExit;
        if (process.platform === 'win32') {
            let spawnArgs = [command, ...args];
            let cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath');
            if (cmdexe) {
                spawnArgs.unshift('\"' + cmdexe + '\"');
            }
            this.process = new interactive_process_1.InteractiveProcess('chcp 65001 && ', spawnArgs, this.didExit.bind(this), { cwd, shell: true }, endPattern);
        }
        else {
            this.process = new interactive_process_1.InteractiveProcess(command, args, this.didExit.bind(this), { cwd }, endPattern);
        }
        let resolveReadyPromise;
        this.readyPromise = new Promise((resolve) => { resolveReadyPromise = resolve; });
        this.process.request(`:set editor \"#{atomPath}\"${os_1.EOL}` +
            `:set prompt2 \"\"${os_1.EOL}` +
            `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${os_1.EOL}`)
            .then(resolveReadyPromise);
    }
    waitReady() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.readyPromise;
        });
    }
    load(uri, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.process.request(`:load ${atom_haskell_utils_1.hsEscapeString(uri)}${os_1.EOL}`, callback);
        });
    }
    reload(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.process.request(`:reload${os_1.EOL}`, callback);
        });
    }
    interrupt() {
        if (this.process) {
            if (atom.config.get('ide-haskell-repl.ghciWrapperPath') && process.platform === 'win32') {
                this.process.request('\x03');
            }
            else {
                this.process.interrupt();
            }
        }
    }
    writeLines(lines, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.process.request(`:{${os_1.EOL}${lines.join(os_1.EOL)}${os_1.EOL}:}${os_1.EOL}`, callback);
        });
    }
    sendCompletionRequest(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.process.request(`:complete repl \"\"${os_1.EOL}`, callback);
        });
    }
    destroy() {
        this.process.destroy();
    }
    didExit(code) {
        this.onDidExit(code);
        this.destroy();
    }
}
exports.GHCI = GHCI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBaUQ7QUFDakQsMkJBQXNCO0FBQ3RCLCtEQUF3RTtBQVV4RTtJQUlFLFlBQWEsSUFBVztRQUN0QixJQUFJLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM1QyxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNuRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNsQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2hFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sT0FBTyxtQkFBbUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUUvRixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDbEIsOEJBQThCLFFBQUcsRUFBRTtZQUNuQyxvQkFBb0IsUUFBRyxFQUFFO1lBQ3pCLDhDQUE4QyxRQUFHLEVBQUUsQ0FDcEQ7YUFDQSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtJQUM1QixDQUFDO0lBRVksU0FBUzs7WUFDcEIsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQTtRQUNoQyxDQUFDO0tBQUE7SUFFWSxJQUFJLENBQUUsR0FBVyxFQUFFLFFBQW1COztZQUNqRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxtQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQzdFLENBQUM7S0FBQTtJQUVZLE1BQU0sQ0FBRSxRQUFtQjs7WUFDdEMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDeEQsQ0FBQztLQUFBO0lBRU0sU0FBUztRQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUM5QixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtZQUMxQixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFWSxVQUFVLENBQUUsS0FBZSxFQUFFLFFBQW1COztZQUMzRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3pCLEtBQUssUUFBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBRyxDQUFDLEdBQUcsUUFBRyxLQUFLLFFBQUcsRUFBRSxFQUMxQyxRQUFRLENBQ1QsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUVZLHFCQUFxQixDQUFFLFFBQW1COztZQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsc0JBQXNCLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQ3BFLENBQUM7S0FBQTtJQUVNLE9BQU87UUFDWixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQ3hCLENBQUM7SUFFTyxPQUFPLENBQUUsSUFBWTtRQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUNoQixDQUFDO0NBQ0Y7QUFwRkQsb0JBb0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtoc0VzY2FwZVN0cmluZ30gZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtFT0x9IGZyb20gJ29zJ1xuaW1wb3J0IHtJbnRlcmFjdGl2ZVByb2Nlc3MsIElSZXF1ZXN0UmVzdWx0fSBmcm9tICcuL2ludGVyYWN0aXZlLXByb2Nlc3MnXG5cbmludGVyZmFjZSBJT3B0cyB7XG4gIGN3ZDogc3RyaW5nXG4gIGF0b21QYXRoOiBzdHJpbmdcbiAgY29tbWFuZDogc3RyaW5nXG4gIGFyZ3M6IHN0cmluZ1tdXG4gIG9uRXhpdDogKGNvZGU6IG51bWJlcikgPT4gdm9pZFxufVxuXG5leHBvcnQgY2xhc3MgR0hDSSB7XG4gIHByaXZhdGUgcHJvY2VzczogSW50ZXJhY3RpdmVQcm9jZXNzXG4gIHByaXZhdGUgcmVhZHlQcm9taXNlOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PlxuICBwcml2YXRlIG9uRGlkRXhpdDogKGNvZGU6IG51bWJlcikgPT4gdm9pZFxuICBjb25zdHJ1Y3RvciAob3B0czogSU9wdHMpIHtcbiAgICBsZXQgZW5kUGF0dGVybiA9IC9eI35JREVIQVNLRUxMUkVQTH4oLiopfiMkL1xuICAgIGxldCB7IGN3ZCwgYXRvbVBhdGgsIGNvbW1hbmQsIGFyZ3MsIG9uRXhpdCB9ID0gb3B0c1xuICAgIHRoaXMub25EaWRFeGl0ID0gb25FeGl0XG5cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgbGV0IHNwYXduQXJncyA9IFtjb21tYW5kLCAuLi5hcmdzXVxuICAgICAgbGV0IGNtZGV4ZSA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKVxuICAgICAgaWYgKGNtZGV4ZSkge1xuICAgICAgICBzcGF3bkFyZ3MudW5zaGlmdCgnXFxcIicgKyBjbWRleGUgKyAnXFxcIicpXG4gICAgICB9XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICAnY2hjcCA2NTAwMSAmJiAnLFxuICAgICAgICBzcGF3bkFyZ3MsXG4gICAgICAgIHRoaXMuZGlkRXhpdC5iaW5kKHRoaXMpLFxuICAgICAgICB7IGN3ZCwgc2hlbGw6IHRydWUgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9jZXNzID0gbmV3IEludGVyYWN0aXZlUHJvY2VzcyhcbiAgICAgICAgY29tbWFuZCxcbiAgICAgICAgYXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkIH0sXG4gICAgICAgIGVuZFBhdHRlcm4sXG4gICAgICApXG4gICAgfVxuXG4gICAgbGV0IHJlc29sdmVSZWFkeVByb21pc2VcbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PigocmVzb2x2ZSkgPT4geyByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSB9KVxuXG4gICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnNldCBlZGl0b3IgXFxcIiN7YXRvbVBhdGh9XFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0MiBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgIC50aGVuKHJlc29sdmVSZWFkeVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd2FpdFJlYWR5ICgpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWFkeVByb21pc2VcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkICh1cmk6IHN0cmluZywgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmxvYWQgJHtoc0VzY2FwZVN0cmluZyh1cmkpfSR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlbG9hZCAoY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOnJlbG9hZCR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKSAmJiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KCdcXHgwMycpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnByb2Nlc3MuaW50ZXJydXB0KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd3JpdGVMaW5lcyAobGluZXM6IHN0cmluZ1tdLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDp7JHtFT0x9JHtsaW5lcy5qb2luKEVPTCl9JHtFT0x9On0ke0VPTH1gLFxuICAgICAgY2FsbGJhY2ssXG4gICAgKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHNlbmRDb21wbGV0aW9uUmVxdWVzdCAoY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmNvbXBsZXRlIHJlcGwgXFxcIlxcXCIke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95ICgpIHtcbiAgICB0aGlzLnByb2Nlc3MuZGVzdHJveSgpXG4gIH1cblxuICBwcml2YXRlIGRpZEV4aXQgKGNvZGU6IG51bWJlcikge1xuICAgIHRoaXMub25EaWRFeGl0KGNvZGUpXG4gICAgdGhpcy5kZXN0cm95KClcbiAgfVxufVxuIl19