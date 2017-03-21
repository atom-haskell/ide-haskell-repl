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
        const endPattern = /^#~IDEHASKELLREPL~(.*)~#$/;
        const { cwd, atomPath, command, args, onExit } = opts;
        this.onDidExit = onExit;
        if (process.platform === 'win32') {
            const spawnArgs = [command, ...args];
            const cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath');
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
        this.process.request(`:set editor \"${atomPath}\"${os_1.EOL}` +
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBaUQ7QUFDakQsMkJBQXNCO0FBQ3RCLCtEQUF1RjtBQVl2RjtJQUtFLFlBQWEsSUFBVztRQUN0QixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sT0FBTyxtQkFBbUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUUvRixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDbEIsaUJBQWlCLFFBQVEsS0FBSyxRQUFHLEVBQUU7WUFDbkMsb0JBQW9CLFFBQUcsRUFBRTtZQUN6Qiw4Q0FBOEMsUUFBRyxFQUFFLENBQ3BEO2FBQ0EsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDNUIsQ0FBQztJQUVZLFNBQVM7O1lBQ3BCLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDaEMsQ0FBQztLQUFBO0lBRVksSUFBSSxDQUFFLEdBQVcsRUFBRSxRQUF3Qjs7WUFDdEQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsbUNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUM3RSxDQUFDO0tBQUE7SUFFWSxNQUFNLENBQUUsUUFBd0I7O1lBQzNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQ3hELENBQUM7S0FBQTtJQUVNLFNBQVM7UUFDZCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDOUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDMUIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVksVUFBVSxDQUFFLEtBQWUsRUFBRSxRQUF3Qjs7WUFDaEUsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUN6QixLQUFLLFFBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQUcsQ0FBQyxHQUFHLFFBQUcsS0FBSyxRQUFHLEVBQUUsRUFDMUMsUUFBUSxDQUNULENBQUE7UUFDSCxDQUFDO0tBQUE7SUFFWSxxQkFBcUIsQ0FBRSxRQUF3Qjs7WUFDMUQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFFLElBQVk7UUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBckZELG9CQXFGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aHNFc2NhcGVTdHJpbmd9IGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7RU9MfSBmcm9tICdvcydcbmltcG9ydCB7SW50ZXJhY3RpdmVQcm9jZXNzLCBJUmVxdWVzdFJlc3VsdCwgVExpbmVDYWxsYmFja30gZnJvbSAnLi9pbnRlcmFjdGl2ZS1wcm9jZXNzJ1xuXG5leHBvcnQge1RMaW5lQ2FsbGJhY2ssIElSZXF1ZXN0UmVzdWx0fVxuXG5leHBvcnQgaW50ZXJmYWNlIElPcHRzIHtcbiAgY3dkOiBzdHJpbmdcbiAgYXRvbVBhdGg6IHN0cmluZ1xuICBjb21tYW5kOiBzdHJpbmdcbiAgYXJnczogc3RyaW5nW11cbiAgb25FeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBjbGFzcyBHSENJIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwcml2YXRlIHByb2Nlc3M6IEludGVyYWN0aXZlUHJvY2Vzc1xuICBwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3IgKG9wdHM6IElPcHRzKSB7XG4gICAgY29uc3QgZW5kUGF0dGVybiA9IC9eI35JREVIQVNLRUxMUkVQTH4oLiopfiMkL1xuICAgIGNvbnN0IHsgY3dkLCBhdG9tUGF0aCwgY29tbWFuZCwgYXJncywgb25FeGl0IH0gPSBvcHRzXG4gICAgdGhpcy5vbkRpZEV4aXQgPSBvbkV4aXRcblxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICBjb25zdCBzcGF3bkFyZ3MgPSBbY29tbWFuZCwgLi4uYXJnc11cbiAgICAgIGNvbnN0IGNtZGV4ZSA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKVxuICAgICAgaWYgKGNtZGV4ZSkge1xuICAgICAgICBzcGF3bkFyZ3MudW5zaGlmdCgnXFxcIicgKyBjbWRleGUgKyAnXFxcIicpXG4gICAgICB9XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICAnY2hjcCA2NTAwMSAmJiAnLFxuICAgICAgICBzcGF3bkFyZ3MsXG4gICAgICAgIHRoaXMuZGlkRXhpdC5iaW5kKHRoaXMpLFxuICAgICAgICB7IGN3ZCwgc2hlbGw6IHRydWUgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9jZXNzID0gbmV3IEludGVyYWN0aXZlUHJvY2VzcyhcbiAgICAgICAgY29tbWFuZCxcbiAgICAgICAgYXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkIH0sXG4gICAgICAgIGVuZFBhdHRlcm4sXG4gICAgICApXG4gICAgfVxuXG4gICAgbGV0IHJlc29sdmVSZWFkeVByb21pc2VcbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PigocmVzb2x2ZSkgPT4geyByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSB9KVxuXG4gICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnNldCBlZGl0b3IgXFxcIiR7YXRvbVBhdGh9XFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0MiBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgIC50aGVuKHJlc29sdmVSZWFkeVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd2FpdFJlYWR5ICgpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWFkeVByb21pc2VcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkICh1cmk6IHN0cmluZywgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6bG9hZCAke2hzRXNjYXBlU3RyaW5nKHVyaSl9JHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVsb2FkIChjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpyZWxvYWQke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIGlmIChhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJykgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICB0aGlzLnByb2Nlc3MucmVxdWVzdCgnXFx4MDMnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzLmludGVycnVwdCgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdyaXRlTGluZXMgKGxpbmVzOiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDp7JHtFT0x9JHtsaW5lcy5qb2luKEVPTCl9JHtFT0x9On0ke0VPTH1gLFxuICAgICAgY2FsbGJhY2ssXG4gICAgKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHNlbmRDb21wbGV0aW9uUmVxdWVzdCAoY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6Y29tcGxldGUgcmVwbCBcXFwiXFxcIiR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3kgKCkge1xuICAgIHRoaXMucHJvY2Vzcy5kZXN0cm95KClcbiAgfVxuXG4gIHByaXZhdGUgZGlkRXhpdCAoY29kZTogbnVtYmVyKSB7XG4gICAgdGhpcy5vbkRpZEV4aXQoY29kZSlcbiAgICB0aGlzLmRlc3Ryb3koKVxuICB9XG59XG4iXX0=