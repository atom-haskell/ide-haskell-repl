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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBbUQ7QUFDbkQsMkJBQXdCO0FBQ3hCLCtEQUF5RjtBQVl6RjtJQUtFLFlBQVksSUFBVztRQUNyQixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsbUJBQW1CLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFFL0YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ2xCLGlCQUFpQixRQUFRLEtBQUssUUFBRyxFQUFFO1lBQ25DLG9CQUFvQixRQUFHLEVBQUU7WUFDekIsOENBQThDLFFBQUcsRUFBRSxDQUNwRDthQUNFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFWSxTQUFTOztZQUNwQixNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFBO1FBQ2hDLENBQUM7S0FBQTtJQUVNLE1BQU07UUFDWCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtJQUM5QixDQUFDO0lBRVksSUFBSSxDQUFDLEdBQVcsRUFBRSxRQUF3Qjs7WUFDckQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsbUNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUM3RSxDQUFDO0tBQUE7SUFFWSxNQUFNLENBQUMsUUFBd0I7O1lBQzFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQ3hELENBQUM7S0FBQTtJQUVNLFNBQVM7UUFDZCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDOUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDMUIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVksVUFBVSxDQUFDLEtBQWUsRUFBRSxRQUF3Qjs7WUFDL0QsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUN6QixLQUFLLFFBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQUcsQ0FBQyxHQUFHLFFBQUcsS0FBSyxRQUFHLEVBQUUsRUFDMUMsUUFBUSxDQUNULENBQUE7UUFDSCxDQUFDO0tBQUE7SUFFTSxRQUFRLENBQUMsR0FBVztRQUN6QixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUM5QixDQUFDO0lBRVkscUJBQXFCLENBQUMsUUFBd0I7O1lBQ3pELE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDcEUsQ0FBQztLQUFBO0lBRU0sT0FBTztRQUNaLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDeEIsQ0FBQztJQUVPLE9BQU8sQ0FBQyxJQUFZO1FBQzFCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUE7UUFDcEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQ2hCLENBQUM7Q0FDRjtBQTdGRCxvQkE2RkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBoc0VzY2FwZVN0cmluZyB9IGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7IEVPTCB9IGZyb20gJ29zJ1xuaW1wb3J0IHsgSW50ZXJhY3RpdmVQcm9jZXNzLCBJUmVxdWVzdFJlc3VsdCwgVExpbmVDYWxsYmFjayB9IGZyb20gJy4vaW50ZXJhY3RpdmUtcHJvY2VzcydcblxuZXhwb3J0IHsgVExpbmVDYWxsYmFjaywgSVJlcXVlc3RSZXN1bHQgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElPcHRzIHtcbiAgY3dkOiBzdHJpbmdcbiAgYXRvbVBhdGg6IHN0cmluZ1xuICBjb21tYW5kOiBzdHJpbmdcbiAgYXJnczogc3RyaW5nW11cbiAgb25FeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBjbGFzcyBHSENJIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHJpdmF0ZSBwcm9jZXNzOiBJbnRlcmFjdGl2ZVByb2Nlc3NcbiAgcHJpdmF0ZSByZWFkeVByb21pc2U6IFByb21pc2U8SVJlcXVlc3RSZXN1bHQ+XG4gIHByaXZhdGUgb25EaWRFeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG4gIGNvbnN0cnVjdG9yKG9wdHM6IElPcHRzKSB7XG4gICAgY29uc3QgZW5kUGF0dGVybiA9IC9eI35JREVIQVNLRUxMUkVQTH4oLiopfiMkL1xuICAgIGNvbnN0IHsgY3dkLCBhdG9tUGF0aCwgY29tbWFuZCwgYXJncywgb25FeGl0IH0gPSBvcHRzXG4gICAgdGhpcy5vbkRpZEV4aXQgPSBvbkV4aXRcblxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICBjb25zdCBzcGF3bkFyZ3MgPSBbY29tbWFuZCwgLi4uYXJnc11cbiAgICAgIGNvbnN0IGNtZGV4ZSA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKVxuICAgICAgaWYgKGNtZGV4ZSkge1xuICAgICAgICBzcGF3bkFyZ3MudW5zaGlmdCgnXFxcIicgKyBjbWRleGUgKyAnXFxcIicpXG4gICAgICB9XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICAnY2hjcCA2NTAwMSAmJiAnLFxuICAgICAgICBzcGF3bkFyZ3MsXG4gICAgICAgIHRoaXMuZGlkRXhpdC5iaW5kKHRoaXMpLFxuICAgICAgICB7IGN3ZCwgc2hlbGw6IHRydWUgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9jZXNzID0gbmV3IEludGVyYWN0aXZlUHJvY2VzcyhcbiAgICAgICAgY29tbWFuZCxcbiAgICAgICAgYXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkIH0sXG4gICAgICAgIGVuZFBhdHRlcm4sXG4gICAgICApXG4gICAgfVxuXG4gICAgbGV0IHJlc29sdmVSZWFkeVByb21pc2VcbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PigocmVzb2x2ZSkgPT4geyByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSB9KVxuXG4gICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnNldCBlZGl0b3IgXFxcIiR7YXRvbVBhdGh9XFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0MiBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgICAgLnRoZW4ocmVzb2x2ZVJlYWR5UHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB3YWl0UmVhZHkoKSB7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucmVhZHlQcm9taXNlXG4gIH1cblxuICBwdWJsaWMgaXNCdXN5KCkge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MuaXNCdXN5KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkKHVyaTogc3RyaW5nLCBjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpsb2FkICR7aHNFc2NhcGVTdHJpbmcodXJpKX0ke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZWxvYWQoY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6cmVsb2FkJHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIGlmIChhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJykgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICB0aGlzLnByb2Nlc3MucmVxdWVzdCgnXFx4MDMnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzLmludGVycnVwdCgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdyaXRlTGluZXMobGluZXM6IHN0cmluZ1tdLCBjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnske0VPTH0ke2xpbmVzLmpvaW4oRU9MKX0ke0VPTH06fSR7RU9MfWAsXG4gICAgICBjYWxsYmFjayxcbiAgICApXG4gIH1cblxuICBwdWJsaWMgd3JpdGVSYXcocmF3OiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2Nlc3Mud3JpdGVTdGRpbihyYXcpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc2VuZENvbXBsZXRpb25SZXF1ZXN0KGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmNvbXBsZXRlIHJlcGwgXFxcIlxcXCIke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95KCkge1xuICAgIHRoaXMucHJvY2Vzcy5kZXN0cm95KClcbiAgfVxuXG4gIHByaXZhdGUgZGlkRXhpdChjb2RlOiBudW1iZXIpIHtcbiAgICB0aGlzLm9uRGlkRXhpdChjb2RlKVxuICAgIHRoaXMuZGVzdHJveSgpXG4gIH1cbn1cbiJdfQ==