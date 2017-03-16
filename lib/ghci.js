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
        return this.process.request(`:load ${atom_haskell_utils_1.hsEscapeString(uri)}${os_1.EOL}`, callback);
    }
    reload(callback) {
        return this.process.request(`:reload${os_1.EOL}`, callback);
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
        console.error('yes');
        return this.process.request(`:{${os_1.EOL}${lines.join(os_1.EOL)}${os_1.EOL}:}${os_1.EOL}`, callback);
    }
    sendCompletionRequest(callback) {
        return this.process.request(`:complete repl \"\"${os_1.EOL}`, callback);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBaUQ7QUFDakQsMkJBQXNCO0FBQ3RCLCtEQUF3RDtBQVV4RDtJQUlFLFlBQWEsSUFBVztRQUN0QixJQUFJLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM1QyxJQUFJLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNuRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNsQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2hFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxPQUFPLG1CQUFtQixHQUFHLE9BQU8sQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBRXJGLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUNsQiw4QkFBOEIsUUFBRyxFQUFFO1lBQ25DLG9CQUFvQixRQUFHLEVBQUU7WUFDekIsOENBQThDLFFBQUcsRUFBRSxDQUNwRDthQUNBLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO0lBQzVCLENBQUM7SUFFWSxTQUFTOztZQUNwQixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDekIsQ0FBQztLQUFBO0lBRU0sSUFBSSxDQUFFLEdBQVcsRUFBRSxRQUFtQjtRQUMzQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxtQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO0lBQzdFLENBQUM7SUFFTSxNQUFNLENBQUUsUUFBbUI7UUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7SUFDeEQsQ0FBQztJQUVNLFNBQVM7UUFDZCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDeEYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDOUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUE7WUFDMUIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRU0sVUFBVSxDQUFFLEtBQWUsRUFBRSxRQUFtQjtRQUNyRCxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3BCLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDekIsS0FBSyxRQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFHLENBQUMsR0FBRyxRQUFHLEtBQUssUUFBRyxFQUFFLEVBQzFDLFFBQVEsQ0FDVCxDQUFBO0lBQ0gsQ0FBQztJQUVNLHFCQUFxQixDQUFFLFFBQW1CO1FBQy9DLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7SUFDcEUsQ0FBQztJQUVNLE9BQU87UUFDWixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQ3hCLENBQUM7SUFFTyxPQUFPLENBQUUsSUFBWTtRQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUNoQixDQUFDO0NBQ0Y7QUFyRkQsb0JBcUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtoc0VzY2FwZVN0cmluZ30gZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHtFT0x9IGZyb20gJ29zJ1xuaW1wb3J0IHtJbnRlcmFjdGl2ZVByb2Nlc3N9IGZyb20gJy4vaW50ZXJhY3RpdmUtcHJvY2VzcydcblxuaW50ZXJmYWNlIElPcHRzIHtcbiAgY3dkOiBzdHJpbmdcbiAgYXRvbVBhdGg6IHN0cmluZ1xuICBjb21tYW5kOiBzdHJpbmdcbiAgYXJnczogc3RyaW5nW11cbiAgb25FeGl0OiAoY29kZTogbnVtYmVyKSA9PiB2b2lkXG59XG5cbmV4cG9ydCBjbGFzcyBHSENJIHtcbiAgcHJpdmF0ZSBwcm9jZXNzOiBJbnRlcmFjdGl2ZVByb2Nlc3NcbiAgcHJpdmF0ZSByZWFkeVByb21pc2U6IFByb21pc2U8dm9pZD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3IgKG9wdHM6IElPcHRzKSB7XG4gICAgbGV0IGVuZFBhdHRlcm4gPSAvXiN+SURFSEFTS0VMTFJFUEx+KC4qKX4jJC9cbiAgICBsZXQgeyBjd2QsIGF0b21QYXRoLCBjb21tYW5kLCBhcmdzLCBvbkV4aXQgfSA9IG9wdHNcbiAgICB0aGlzLm9uRGlkRXhpdCA9IG9uRXhpdFxuXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGxldCBzcGF3bkFyZ3MgPSBbY29tbWFuZCwgLi4uYXJnc11cbiAgICAgIGxldCBjbWRleGUgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJylcbiAgICAgIGlmIChjbWRleGUpIHtcbiAgICAgICAgc3Bhd25BcmdzLnVuc2hpZnQoJ1xcXCInICsgY21kZXhlICsgJ1xcXCInKVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9jZXNzID0gbmV3IEludGVyYWN0aXZlUHJvY2VzcyhcbiAgICAgICAgJ2NoY3AgNjUwMDEgJiYgJyxcbiAgICAgICAgc3Bhd25BcmdzLFxuICAgICAgICB0aGlzLmRpZEV4aXQuYmluZCh0aGlzKSxcbiAgICAgICAgeyBjd2QsIHNoZWxsOiB0cnVlIH0sXG4gICAgICAgIGVuZFBhdHRlcm4sXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHJvY2VzcyA9IG5ldyBJbnRlcmFjdGl2ZVByb2Nlc3MoXG4gICAgICAgIGNvbW1hbmQsXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIHRoaXMuZGlkRXhpdC5iaW5kKHRoaXMpLFxuICAgICAgICB7IGN3ZCB9LFxuICAgICAgICBlbmRQYXR0ZXJuLFxuICAgICAgKVxuICAgIH1cblxuICAgIGxldCByZXNvbHZlUmVhZHlQcm9taXNlXG4gICAgdGhpcy5yZWFkeVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4geyByZXNvbHZlUmVhZHlQcm9taXNlID0gcmVzb2x2ZSB9KVxuXG4gICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoXG4gICAgICBgOnNldCBlZGl0b3IgXFxcIiN7YXRvbVBhdGh9XFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0MiBcXFwiXFxcIiR7RU9MfWAgK1xuICAgICAgYDpzZXQgcHJvbXB0IFxcXCJcXFxcbiN+SURFSEFTS0VMTFJFUEx+JXN+I1xcXFxuXFxcIiR7RU9MfWAsXG4gICAgKVxuICAgIC50aGVuKHJlc29sdmVSZWFkeVByb21pc2UpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd2FpdFJlYWR5ICgpIHtcbiAgICBhd2FpdCB0aGlzLnJlYWR5UHJvbWlzZVxuICB9XG5cbiAgcHVibGljIGxvYWQgKHVyaTogc3RyaW5nLCBjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6bG9hZCAke2hzRXNjYXBlU3RyaW5nKHVyaSl9JHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgcmVsb2FkIChjYWxsYmFjaz86IEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6cmVsb2FkJHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICBpZiAoYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpICYmIHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzLnJlcXVlc3QoJ1xceDAzJylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucHJvY2Vzcy5pbnRlcnJ1cHQoKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyB3cml0ZUxpbmVzIChsaW5lczogc3RyaW5nW10sIGNhbGxiYWNrPzogRnVuY3Rpb24pIHtcbiAgICBjb25zb2xlLmVycm9yKCd5ZXMnKVxuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChcbiAgICAgIGA6eyR7RU9MfSR7bGluZXMuam9pbihFT0wpfSR7RU9MfTp9JHtFT0x9YCxcbiAgICAgIGNhbGxiYWNrLFxuICAgIClcbiAgfVxuXG4gIHB1YmxpYyBzZW5kQ29tcGxldGlvblJlcXVlc3QgKGNhbGxiYWNrPzogRnVuY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpjb21wbGV0ZSByZXBsIFxcXCJcXFwiJHtFT0x9YCwgY2FsbGJhY2spXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSAoKSB7XG4gICAgdGhpcy5wcm9jZXNzLmRlc3Ryb3koKVxuICB9XG5cbiAgcHJpdmF0ZSBkaWRFeGl0IChjb2RlOiBudW1iZXIpIHtcbiAgICB0aGlzLm9uRGlkRXhpdChjb2RlKVxuICAgIHRoaXMuZGVzdHJveSgpXG4gIH1cbn1cbiJdfQ==