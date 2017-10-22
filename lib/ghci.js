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
        this.readyPromise = this.process.request(`:set editor \"${atomPath}\"${os_1.EOL}` +
            `:set prompt2 \"\"${os_1.EOL}` +
            `:set prompt-cont \"\"${os_1.EOL}` +
            `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${os_1.EOL}`);
    }
    waitReady() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.readyPromise;
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
        return __awaiter(this, void 0, void 0, function* () {
            if (this.process) {
                if (atom.config.get('ide-haskell-repl.ghciWrapperPath') && process.platform === 'win32') {
                    yield this.process.request('\x03');
                }
                else {
                    this.process.interrupt();
                }
            }
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBbUQ7QUFDbkQsMkJBQXdCO0FBQ3hCLCtEQUF5RjtBQVl6RjtJQUtFLFlBQVksSUFBVztRQUNyQixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDdEMsaUJBQWlCLFFBQVEsS0FBSyxRQUFHLEVBQUU7WUFDbkMsb0JBQW9CLFFBQUcsRUFBRTtZQUN6Qix3QkFBd0IsUUFBRyxFQUFFO1lBQzdCLDhDQUE4QyxRQUFHLEVBQUUsQ0FDcEQsQ0FBQTtJQUNILENBQUM7SUFFWSxTQUFTOztZQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQTtRQUMxQixDQUFDO0tBQUE7SUFFTSxNQUFNO1FBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUE7SUFDOUIsQ0FBQztJQUVZLElBQUksQ0FBQyxHQUFXLEVBQUUsUUFBd0I7O1lBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLG1DQUFjLENBQUMsR0FBRyxDQUFDLEdBQUcsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDN0UsQ0FBQztLQUFBO0lBRVksTUFBTSxDQUFDLFFBQXdCOztZQUMxQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUN4RCxDQUFDO0tBQUE7SUFFWSxTQUFTOztZQUNwQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDakIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsa0NBQWtDLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQ3hGLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7Z0JBQ3BDLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtnQkFDMUIsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0tBQUE7SUFFWSxVQUFVLENBQUMsS0FBZSxFQUFFLFFBQXdCOztZQUMvRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3pCLEtBQUssUUFBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBRyxDQUFDLEdBQUcsUUFBRyxLQUFLLFFBQUcsRUFBRSxFQUMxQyxRQUFRLENBQ1QsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUVNLFFBQVEsQ0FBQyxHQUFXO1FBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFWSxxQkFBcUIsQ0FBQyxRQUF3Qjs7WUFDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFDLElBQVk7UUFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBMUZELG9CQTBGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhzRXNjYXBlU3RyaW5nIH0gZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnXG5pbXBvcnQgeyBJbnRlcmFjdGl2ZVByb2Nlc3MsIElSZXF1ZXN0UmVzdWx0LCBUTGluZUNhbGxiYWNrIH0gZnJvbSAnLi9pbnRlcmFjdGl2ZS1wcm9jZXNzJ1xuXG5leHBvcnQgeyBUTGluZUNhbGxiYWNrLCBJUmVxdWVzdFJlc3VsdCB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9wdHMge1xuICBjd2Q6IHN0cmluZ1xuICBhdG9tUGF0aDogc3RyaW5nXG4gIGNvbW1hbmQ6IHN0cmluZ1xuICBhcmdzOiBzdHJpbmdbXVxuICBvbkV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbn1cblxuZXhwb3J0IGNsYXNzIEdIQ0kge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIHByb2Nlc3M6IEludGVyYWN0aXZlUHJvY2Vzc1xuICBwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3Iob3B0czogSU9wdHMpIHtcbiAgICBjb25zdCBlbmRQYXR0ZXJuID0gL14jfklERUhBU0tFTExSRVBMfiguKil+IyQvXG4gICAgY29uc3QgeyBjd2QsIGF0b21QYXRoLCBjb21tYW5kLCBhcmdzLCBvbkV4aXQgfSA9IG9wdHNcbiAgICB0aGlzLm9uRGlkRXhpdCA9IG9uRXhpdFxuXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGNvbnN0IHNwYXduQXJncyA9IFtjb21tYW5kLCAuLi5hcmdzXVxuICAgICAgY29uc3QgY21kZXhlID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpXG4gICAgICBpZiAoY21kZXhlKSB7XG4gICAgICAgIHNwYXduQXJncy51bnNoaWZ0KCdcXFwiJyArIGNtZGV4ZSArICdcXFwiJylcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2VzcyA9IG5ldyBJbnRlcmFjdGl2ZVByb2Nlc3MoXG4gICAgICAgICdjaGNwIDY1MDAxICYmICcsXG4gICAgICAgIHNwYXduQXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkLCBzaGVsbDogdHJ1ZSB9LFxuICAgICAgICBlbmRQYXR0ZXJuLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICB0aGlzLmRpZEV4aXQuYmluZCh0aGlzKSxcbiAgICAgICAgeyBjd2QgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9XG5cbiAgICB0aGlzLnJlYWR5UHJvbWlzZSA9IHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDpzZXQgZWRpdG9yIFxcXCIke2F0b21QYXRofVxcXCIke0VPTH1gICtcbiAgICAgIGA6c2V0IHByb21wdDIgXFxcIlxcXCIke0VPTH1gICtcbiAgICAgIGA6c2V0IHByb21wdC1jb250IFxcXCJcXFwiJHtFT0x9YCArXG4gICAgICBgOnNldCBwcm9tcHQgXFxcIlxcXFxuI35JREVIQVNLRUxMUkVQTH4lc34jXFxcXG5cXFwiJHtFT0x9YCxcbiAgICApXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd2FpdFJlYWR5KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWR5UHJvbWlzZVxuICB9XG5cbiAgcHVibGljIGlzQnVzeSgpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLmlzQnVzeSgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgbG9hZCh1cmk6IHN0cmluZywgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6bG9hZCAke2hzRXNjYXBlU3RyaW5nKHVyaSl9JHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVsb2FkKGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOnJlbG9hZCR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGludGVycnVwdCgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICBpZiAoYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpICYmIHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzLnJlcXVlc3QoJ1xceDAzJylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHJvY2Vzcy5pbnRlcnJ1cHQoKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyB3cml0ZUxpbmVzKGxpbmVzOiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KFxuICAgICAgYDp7JHtFT0x9JHtsaW5lcy5qb2luKEVPTCl9JHtFT0x9On0ke0VPTH1gLFxuICAgICAgY2FsbGJhY2ssXG4gICAgKVxuICB9XG5cbiAgcHVibGljIHdyaXRlUmF3KHJhdzogc3RyaW5nKSB7XG4gICAgdGhpcy5wcm9jZXNzLndyaXRlU3RkaW4ocmF3KVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHNlbmRDb21wbGV0aW9uUmVxdWVzdChjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpjb21wbGV0ZSByZXBsIFxcXCJcXFwiJHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICB0aGlzLnByb2Nlc3MuZGVzdHJveSgpXG4gIH1cblxuICBwcml2YXRlIGRpZEV4aXQoY29kZTogbnVtYmVyKSB7XG4gICAgdGhpcy5vbkRpZEV4aXQoY29kZSlcbiAgICB0aGlzLmRlc3Ryb3koKVxuICB9XG59XG4iXX0=