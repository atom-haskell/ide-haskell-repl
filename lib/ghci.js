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
    isBusy() {
        return this.process.isBusy();
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
    writeRaw(raw) {
        this.process.writeStdin(raw);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBaUQ7QUFDakQsMkJBQXNCO0FBQ3RCLCtEQUF1RjtBQVl2RjtJQUtFLFlBQWEsSUFBVztRQUN0QixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sT0FBTyxtQkFBbUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUUvRixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDbEIsaUJBQWlCLFFBQVEsS0FBSyxRQUFHLEVBQUU7WUFDbkMsb0JBQW9CLFFBQUcsRUFBRTtZQUN6Qiw4Q0FBOEMsUUFBRyxFQUFFLENBQ3BEO2FBQ0EsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDNUIsQ0FBQztJQUVZLFNBQVM7O1lBQ3BCLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDaEMsQ0FBQztLQUFBO0lBRU0sTUFBTTtRQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFBO0lBQzlCLENBQUM7SUFFWSxJQUFJLENBQUUsR0FBVyxFQUFFLFFBQXdCOztZQUN0RCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxtQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQzdFLENBQUM7S0FBQTtJQUVZLE1BQU0sQ0FBRSxRQUF3Qjs7WUFDM0MsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDeEQsQ0FBQztLQUFBO0lBRU0sU0FBUztRQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUM5QixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtZQUMxQixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFWSxVQUFVLENBQUUsS0FBZSxFQUFFLFFBQXdCOztZQUNoRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3pCLEtBQUssUUFBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBRyxDQUFDLEdBQUcsUUFBRyxLQUFLLFFBQUcsRUFBRSxFQUMxQyxRQUFRLENBQ1QsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUVNLFFBQVEsQ0FBRSxHQUFXO1FBQzFCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFWSxxQkFBcUIsQ0FBRSxRQUF3Qjs7WUFDMUQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFFLElBQVk7UUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBN0ZELG9CQTZGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aHNFc2NhcGVTdHJpbmd9IGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7RU9MfSBmcm9tICdvcydcbmltcG9ydCB7SW50ZXJhY3RpdmVQcm9jZXNzLCBJUmVxdWVzdFJlc3VsdCwgVExpbmVDYWxsYmFja30gZnJvbSAnLi9pbnRlcmFjdGl2ZS1wcm9jZXNzJ1xuXG5leHBvcnQge1RMaW5lQ2FsbGJhY2ssIElSZXF1ZXN0UmVzdWx0fVxuXG5leHBvcnQgaW50ZXJmYWNlIElPcHRzIHtcbiAgY3dkOiBzdHJpbmdcbiAgYXRvbVBhdGg6IHN0cmluZ1xuICBjb21tYW5kOiBzdHJpbmdcbiAgYXJnczogc3RyaW5nW11cbiAgb25FeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBjbGFzcyBHSENJIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWQtY2xhc3MtcHJvcGVydGllc1xuICBwcml2YXRlIHByb2Nlc3M6IEludGVyYWN0aXZlUHJvY2Vzc1xuICBwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3IgKG9wdHM6IElPcHRzKSB7XG4gICAgY29uc3QgZW5kUGF0dGVybiA9IC9eI35JREVIQVNLRUxMUkVQTH4oLiopfiMkL1xuICAgIGNvbnN0IHsgY3dkLCBhdG9tUGF0aCwgY29tbWFuZCwgYXJncywgb25FeGl0IH0gPSBvcHRzXG4gICAgdGhpcy5vbkRpZEV4aXQgPSBvbkV4aXRcblxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICBjb25zdCBzcGF3bkFyZ3MgPSBbY29tbWFuZCwgLi4uYXJnc11cbiAgICAgIGNvbnN0IGNtZGV4ZSA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKVxuICAgICAgaWYgKGNtZGV4ZSkge1xuICAgICAgICBzcGF3bkFyZ3MudW5zaGlmdCgnXFxcIicgKyBjbWRleGUgKyAnXFxcIicpXG4gICAgICB9XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICAnY2hjcCA2NTAwMSAmJiAnLFxuICAgICAgICBzcGF3bkFyZ3MsXG4gICAgICAgIHRoaXMuZGlkRXhpdC5iaW5kKHRoaXMpLFxuICAgICAgICB7IGN3ZCwgc2hlbGw6IHRydWUgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9jZXNzID0gbmV3IEludGVyYWN0aXZlUHJvY2VzcyhcbiAgICAgICAgY29tbWFuZCxcbiAgICAgICAgYXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkIH0sXG4gICAgICAgIGVuZFBhdHRlcm4sXG4gICAgICApXG4gICAgfVxuXG4gICAgbGV0IHJlc29sdmVSZWFkeVByb21pc2VcbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PigocmVzb2x2ZSkgPT4geyByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSB9KVxuXG4gICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnNldCBlZGl0b3IgXFxcIiR7YXRvbVBhdGh9XFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0MiBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgIC50aGVuKHJlc29sdmVSZWFkeVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd2FpdFJlYWR5ICgpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWFkeVByb21pc2VcbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3kgKCkge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MuaXNCdXN5KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkICh1cmk6IHN0cmluZywgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6bG9hZCAke2hzRXNjYXBlU3RyaW5nKHVyaSl9JHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVsb2FkIChjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpyZWxvYWQke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIGlmIChhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJykgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICB0aGlzLnByb2Nlc3MucmVxdWVzdCgnXFx4MDMnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzLmludGVycnVwdCgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdyaXRlTGluZXMgKGxpbmVzOiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDp7JHtFT0x9JHtsaW5lcy5qb2luKEVPTCl9JHtFT0x9On0ke0VPTH1gLFxuICAgICAgY2FsbGJhY2ssXG4gICAgKVxuICB9XG5cbiAgcHVibGljIHdyaXRlUmF3IChyYXc6IHN0cmluZykge1xuICAgIHRoaXMucHJvY2Vzcy53cml0ZVN0ZGluKHJhdylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzZW5kQ29tcGxldGlvblJlcXVlc3QgKGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmNvbXBsZXRlIHJlcGwgXFxcIlxcXCIke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95ICgpIHtcbiAgICB0aGlzLnByb2Nlc3MuZGVzdHJveSgpXG4gIH1cblxuICBwcml2YXRlIGRpZEV4aXQgKGNvZGU6IG51bWJlcikge1xuICAgIHRoaXMub25EaWRFeGl0KGNvZGUpXG4gICAgdGhpcy5kZXN0cm95KClcbiAgfVxufVxuIl19