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
            yield this.readyPromise;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBaUQ7QUFDakQsMkJBQXNCO0FBQ3RCLCtEQUF3RDtBQVV4RDtJQUlFLFlBQWEsSUFBVztRQUN0QixJQUFJLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM1QyxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNuRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNsQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2hFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxPQUFPLG1CQUFtQixHQUFHLE9BQU8sQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBRXJGLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUNsQiw4QkFBOEIsUUFBRyxFQUFFO1lBQ25DLG9CQUFvQixRQUFHLEVBQUU7WUFDekIsOENBQThDLFFBQUcsRUFBRSxDQUNwRDthQUNBLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO0lBQzVCLENBQUM7SUFFWSxTQUFTOztZQUNwQixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDekIsQ0FBQztLQUFBO0lBRVksSUFBSSxDQUFFLEdBQVcsRUFBRSxRQUFtQjs7WUFDakQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsbUNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUM3RSxDQUFDO0tBQUE7SUFFWSxNQUFNLENBQUUsUUFBbUI7O1lBQ3RDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQ3hELENBQUM7S0FBQTtJQUVNLFNBQVM7UUFDZCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDOUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDMUIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVksVUFBVSxDQUFFLEtBQWUsRUFBRSxRQUFtQjs7WUFDM0QsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUN6QixLQUFLLFFBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQUcsQ0FBQyxHQUFHLFFBQUcsS0FBSyxRQUFHLEVBQUUsRUFDMUMsUUFBUSxDQUNULENBQUE7UUFDSCxDQUFDO0tBQUE7SUFFWSxxQkFBcUIsQ0FBRSxRQUFtQjs7WUFDckQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFFLElBQVk7UUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBcEZELG9CQW9GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aHNFc2NhcGVTdHJpbmd9IGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7RU9MfSBmcm9tICdvcydcbmltcG9ydCB7SW50ZXJhY3RpdmVQcm9jZXNzfSBmcm9tICcuL2ludGVyYWN0aXZlLXByb2Nlc3MnXG5cbmludGVyZmFjZSBJT3B0cyB7XG4gIGN3ZDogc3RyaW5nXG4gIGF0b21QYXRoOiBzdHJpbmdcbiAgY29tbWFuZDogc3RyaW5nXG4gIGFyZ3M6IHN0cmluZ1tdXG4gIG9uRXhpdDogKGNvZGU6IG51bWJlcikgPT4gdm9pZFxufVxuXG5leHBvcnQgY2xhc3MgR0hDSSB7XG4gIHByaXZhdGUgcHJvY2VzczogSW50ZXJhY3RpdmVQcm9jZXNzXG4gIHByaXZhdGUgcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+XG4gIHByaXZhdGUgb25EaWRFeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG4gIGNvbnN0cnVjdG9yIChvcHRzOiBJT3B0cykge1xuICAgIGxldCBlbmRQYXR0ZXJuID0gL14jfklERUhBU0tFTExSRVBMfiguKil+IyQvXG4gICAgbGV0IHsgY3dkLCBhdG9tUGF0aCwgY29tbWFuZCwgYXJncywgb25FeGl0IH0gPSBvcHRzXG4gICAgdGhpcy5vbkRpZEV4aXQgPSBvbkV4aXRcblxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICBsZXQgc3Bhd25BcmdzID0gW2NvbW1hbmQsIC4uLmFyZ3NdXG4gICAgICBsZXQgY21kZXhlID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpXG4gICAgICBpZiAoY21kZXhlKSB7XG4gICAgICAgIHNwYXduQXJncy51bnNoaWZ0KCdcXFwiJyArIGNtZGV4ZSArICdcXFwiJylcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2VzcyA9IG5ldyBJbnRlcmFjdGl2ZVByb2Nlc3MoXG4gICAgICAgICdjaGNwIDY1MDAxICYmICcsXG4gICAgICAgIHNwYXduQXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkLCBzaGVsbDogdHJ1ZSB9LFxuICAgICAgICBlbmRQYXR0ZXJuLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICB0aGlzLmRpZEV4aXQuYmluZCh0aGlzKSxcbiAgICAgICAgeyBjd2QgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9XG5cbiAgICBsZXQgcmVzb2x2ZVJlYWR5UHJvbWlzZVxuICAgIHRoaXMucmVhZHlQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHsgcmVzb2x2ZVJlYWR5UHJvbWlzZSA9IHJlc29sdmUgfSlcblxuICAgIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDpzZXQgZWRpdG9yIFxcXCIje2F0b21QYXRofVxcXCIke0VPTH1gICtcbiAgICAgIGA6c2V0IHByb21wdDIgXFxcIlxcXCIke0VPTH1gICtcbiAgICAgIGA6c2V0IHByb21wdCBcXFwiXFxcXG4jfklERUhBU0tFTExSRVBMfiVzfiNcXFxcblxcXCIke0VPTH1gLFxuICAgIClcbiAgICAudGhlbihyZXNvbHZlUmVhZHlQcm9taXNlKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdhaXRSZWFkeSAoKSB7XG4gICAgYXdhaXQgdGhpcy5yZWFkeVByb21pc2VcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkICh1cmk6IHN0cmluZywgY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmxvYWQgJHtoc0VzY2FwZVN0cmluZyh1cmkpfSR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlbG9hZCAoY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOnJlbG9hZCR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKSAmJiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KCdcXHgwMycpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnByb2Nlc3MuaW50ZXJydXB0KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd3JpdGVMaW5lcyAobGluZXM6IHN0cmluZ1tdLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDp7JHtFT0x9JHtsaW5lcy5qb2luKEVPTCl9JHtFT0x9On0ke0VPTH1gLFxuICAgICAgY2FsbGJhY2ssXG4gICAgKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHNlbmRDb21wbGV0aW9uUmVxdWVzdCAoY2FsbGJhY2s/OiBGdW5jdGlvbikge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmNvbXBsZXRlIHJlcGwgXFxcIlxcXCIke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95ICgpIHtcbiAgICB0aGlzLnByb2Nlc3MuZGVzdHJveSgpXG4gIH1cblxuICBwcml2YXRlIGRpZEV4aXQgKGNvZGU6IG51bWJlcikge1xuICAgIHRoaXMub25EaWRFeGl0KGNvZGUpXG4gICAgdGhpcy5kZXN0cm95KClcbiAgfVxufVxuIl19