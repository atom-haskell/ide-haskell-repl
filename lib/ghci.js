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
            `:set prompt-cont \"\"${os_1.EOL}` +
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBbUQ7QUFDbkQsMkJBQXdCO0FBQ3hCLCtEQUF5RjtBQVl6RjtJQUtFLFlBQVksSUFBVztRQUNyQixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsbUJBQW1CLEdBQUcsT0FBTyxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFFL0YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ2xCLGlCQUFpQixRQUFRLEtBQUssUUFBRyxFQUFFO1lBQ25DLG9CQUFvQixRQUFHLEVBQUU7WUFDekIsd0JBQXdCLFFBQUcsRUFBRTtZQUM3Qiw4Q0FBOEMsUUFBRyxFQUFFLENBQ3BEO2FBQ0UsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDOUIsQ0FBQztJQUVZLFNBQVM7O1lBQ3BCLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDaEMsQ0FBQztLQUFBO0lBRU0sTUFBTTtRQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFBO0lBQzlCLENBQUM7SUFFWSxJQUFJLENBQUMsR0FBVyxFQUFFLFFBQXdCOztZQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxtQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQzdFLENBQUM7S0FBQTtJQUVZLE1BQU0sQ0FBQyxRQUF3Qjs7WUFDMUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDeEQsQ0FBQztLQUFBO0lBRU0sU0FBUztRQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUM5QixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtZQUMxQixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFWSxVQUFVLENBQUMsS0FBZSxFQUFFLFFBQXdCOztZQUMvRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3pCLEtBQUssUUFBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBRyxDQUFDLEdBQUcsUUFBRyxLQUFLLFFBQUcsRUFBRSxFQUMxQyxRQUFRLENBQ1QsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUVNLFFBQVEsQ0FBQyxHQUFXO1FBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFWSxxQkFBcUIsQ0FBQyxRQUF3Qjs7WUFDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFDLElBQVk7UUFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBOUZELG9CQThGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhzRXNjYXBlU3RyaW5nIH0gZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnXG5pbXBvcnQgeyBJbnRlcmFjdGl2ZVByb2Nlc3MsIElSZXF1ZXN0UmVzdWx0LCBUTGluZUNhbGxiYWNrIH0gZnJvbSAnLi9pbnRlcmFjdGl2ZS1wcm9jZXNzJ1xuXG5leHBvcnQgeyBUTGluZUNhbGxiYWNrLCBJUmVxdWVzdFJlc3VsdCB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9wdHMge1xuICBjd2Q6IHN0cmluZ1xuICBhdG9tUGF0aDogc3RyaW5nXG4gIGNvbW1hbmQ6IHN0cmluZ1xuICBhcmdzOiBzdHJpbmdbXVxuICBvbkV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbn1cblxuZXhwb3J0IGNsYXNzIEdIQ0kge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIHByb2Nlc3M6IEludGVyYWN0aXZlUHJvY2Vzc1xuICBwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3Iob3B0czogSU9wdHMpIHtcbiAgICBjb25zdCBlbmRQYXR0ZXJuID0gL14jfklERUhBU0tFTExSRVBMfiguKil+IyQvXG4gICAgY29uc3QgeyBjd2QsIGF0b21QYXRoLCBjb21tYW5kLCBhcmdzLCBvbkV4aXQgfSA9IG9wdHNcbiAgICB0aGlzLm9uRGlkRXhpdCA9IG9uRXhpdFxuXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGNvbnN0IHNwYXduQXJncyA9IFtjb21tYW5kLCAuLi5hcmdzXVxuICAgICAgY29uc3QgY21kZXhlID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpXG4gICAgICBpZiAoY21kZXhlKSB7XG4gICAgICAgIHNwYXduQXJncy51bnNoaWZ0KCdcXFwiJyArIGNtZGV4ZSArICdcXFwiJylcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2VzcyA9IG5ldyBJbnRlcmFjdGl2ZVByb2Nlc3MoXG4gICAgICAgICdjaGNwIDY1MDAxICYmICcsXG4gICAgICAgIHNwYXduQXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkLCBzaGVsbDogdHJ1ZSB9LFxuICAgICAgICBlbmRQYXR0ZXJuLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICB0aGlzLmRpZEV4aXQuYmluZCh0aGlzKSxcbiAgICAgICAgeyBjd2QgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9XG5cbiAgICBsZXQgcmVzb2x2ZVJlYWR5UHJvbWlzZVxuICAgIHRoaXMucmVhZHlQcm9taXNlID0gbmV3IFByb21pc2U8SVJlcXVlc3RSZXN1bHQ+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVSZWFkeVByb21pc2UgPSByZXNvbHZlIH0pXG5cbiAgICB0aGlzLnByb2Nlc3MucmVxdWVzdChcbiAgICAgIGA6c2V0IGVkaXRvciBcXFwiJHthdG9tUGF0aH1cXFwiJHtFT0x9YCArXG4gICAgICBgOnNldCBwcm9tcHQyIFxcXCJcXFwiJHtFT0x9YCArXG4gICAgICBgOnNldCBwcm9tcHQtY29udCBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgICAgLnRoZW4ocmVzb2x2ZVJlYWR5UHJvbWlzZSlcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB3YWl0UmVhZHkoKSB7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMucmVhZHlQcm9taXNlXG4gIH1cblxuICBwdWJsaWMgaXNCdXN5KCkge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MuaXNCdXN5KClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBsb2FkKHVyaTogc3RyaW5nLCBjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpsb2FkICR7aHNFc2NhcGVTdHJpbmcodXJpKX0ke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZWxvYWQoY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6cmVsb2FkJHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIGlmIChhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJykgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICB0aGlzLnByb2Nlc3MucmVxdWVzdCgnXFx4MDMnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzLmludGVycnVwdCgpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdyaXRlTGluZXMobGluZXM6IHN0cmluZ1tdLCBjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnske0VPTH0ke2xpbmVzLmpvaW4oRU9MKX0ke0VPTH06fSR7RU9MfWAsXG4gICAgICBjYWxsYmFjayxcbiAgICApXG4gIH1cblxuICBwdWJsaWMgd3JpdGVSYXcocmF3OiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2Nlc3Mud3JpdGVTdGRpbihyYXcpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgc2VuZENvbXBsZXRpb25SZXF1ZXN0KGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmNvbXBsZXRlIHJlcGwgXFxcIlxcXCIke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95KCkge1xuICAgIHRoaXMucHJvY2Vzcy5kZXN0cm95KClcbiAgfVxuXG4gIHByaXZhdGUgZGlkRXhpdChjb2RlOiBudW1iZXIpIHtcbiAgICB0aGlzLm9uRGlkRXhpdChjb2RlKVxuICAgIHRoaXMuZGVzdHJveSgpXG4gIH1cbn1cbiJdfQ==