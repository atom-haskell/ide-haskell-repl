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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2hjaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9naGNpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBbUQ7QUFDbkQsMkJBQXdCO0FBQ3hCLCtEQUF5RjtBQVl6RjtJQUtFLFlBQVksSUFBVztRQUNyQixNQUFNLFVBQVUsR0FBRywyQkFBMkIsQ0FBQTtRQUM5QyxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQTtRQUNyRCxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQTtRQUV2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQTtZQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFBO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFBO1lBQ3pDLENBQUM7WUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLGdCQUFnQixFQUNoQixTQUFTLEVBQ1QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFDcEIsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksd0NBQWtCLENBQ25DLE9BQU8sRUFDUCxJQUFJLEVBQ0osSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLEVBQ1AsVUFBVSxDQUNYLENBQUE7UUFDSCxDQUFDO1FBRUQsSUFBSSxtQkFBbUIsQ0FBQTtRQUN2QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksT0FBTyxDQUFpQixDQUFDLE9BQU8sT0FBTyxtQkFBbUIsR0FBRyxPQUFPLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUUvRixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FDbEIsaUJBQWlCLFFBQVEsS0FBSyxRQUFHLEVBQUU7WUFDbkMsb0JBQW9CLFFBQUcsRUFBRTtZQUN6Qiw4Q0FBOEMsUUFBRyxFQUFFLENBQ3BEO2FBQ0UsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUE7SUFDOUIsQ0FBQztJQUVZLFNBQVM7O1lBQ3BCLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUE7UUFDaEMsQ0FBQztLQUFBO0lBRU0sTUFBTTtRQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFBO0lBQzlCLENBQUM7SUFFWSxJQUFJLENBQUMsR0FBVyxFQUFFLFFBQXdCOztZQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxtQ0FBYyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQzdFLENBQUM7S0FBQTtJQUVZLE1BQU0sQ0FBQyxRQUF3Qjs7WUFDMUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsUUFBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7UUFDeEQsQ0FBQztLQUFBO0lBRU0sU0FBUztRQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUN4RixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUM5QixDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtZQUMxQixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFWSxVQUFVLENBQUMsS0FBZSxFQUFFLFFBQXdCOztZQUMvRCxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQ3pCLEtBQUssUUFBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBRyxDQUFDLEdBQUcsUUFBRyxLQUFLLFFBQUcsRUFBRSxFQUMxQyxRQUFRLENBQ1QsQ0FBQTtRQUNILENBQUM7S0FBQTtJQUVNLFFBQVEsQ0FBQyxHQUFXO1FBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFWSxxQkFBcUIsQ0FBQyxRQUF3Qjs7WUFDekQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLHNCQUFzQixRQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQTtRQUNwRSxDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQTtJQUN4QixDQUFDO0lBRU8sT0FBTyxDQUFDLElBQVk7UUFDMUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7SUFDaEIsQ0FBQztDQUNGO0FBN0ZELG9CQTZGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGhzRXNjYXBlU3RyaW5nIH0gZnJvbSAnYXRvbS1oYXNrZWxsLXV0aWxzJ1xuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnXG5pbXBvcnQgeyBJbnRlcmFjdGl2ZVByb2Nlc3MsIElSZXF1ZXN0UmVzdWx0LCBUTGluZUNhbGxiYWNrIH0gZnJvbSAnLi9pbnRlcmFjdGl2ZS1wcm9jZXNzJ1xuXG5leHBvcnQgeyBUTGluZUNhbGxiYWNrLCBJUmVxdWVzdFJlc3VsdCB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9wdHMge1xuICBjd2Q6IHN0cmluZ1xuICBhdG9tUGF0aDogc3RyaW5nXG4gIGNvbW1hbmQ6IHN0cmluZ1xuICBhcmdzOiBzdHJpbmdbXVxuICBvbkV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbn1cblxuZXhwb3J0IGNsYXNzIEdIQ0kge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIHByb2Nlc3M6IEludGVyYWN0aXZlUHJvY2Vzc1xuICBwcml2YXRlIHJlYWR5UHJvbWlzZTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD5cbiAgcHJpdmF0ZSBvbkRpZEV4aXQ6IChjb2RlOiBudW1iZXIpID0+IHZvaWRcbiAgY29uc3RydWN0b3Iob3B0czogSU9wdHMpIHtcbiAgICBjb25zdCBlbmRQYXR0ZXJuID0gL14jfklERUhBU0tFTExSRVBMfiguKil+IyQvXG4gICAgY29uc3QgeyBjd2QsIGF0b21QYXRoLCBjb21tYW5kLCBhcmdzLCBvbkV4aXQgfSA9IG9wdHNcbiAgICB0aGlzLm9uRGlkRXhpdCA9IG9uRXhpdFxuXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGNvbnN0IHNwYXduQXJncyA9IFtjb21tYW5kLCAuLi5hcmdzXVxuICAgICAgY29uc3QgY21kZXhlID0gYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCcpXG4gICAgICBpZiAoY21kZXhlKSB7XG4gICAgICAgIHNwYXduQXJncy51bnNoaWZ0KCdcXFwiJyArIGNtZGV4ZSArICdcXFwiJylcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2VzcyA9IG5ldyBJbnRlcmFjdGl2ZVByb2Nlc3MoXG4gICAgICAgICdjaGNwIDY1MDAxICYmICcsXG4gICAgICAgIHNwYXduQXJncyxcbiAgICAgICAgdGhpcy5kaWRFeGl0LmJpbmQodGhpcyksXG4gICAgICAgIHsgY3dkLCBzaGVsbDogdHJ1ZSB9LFxuICAgICAgICBlbmRQYXR0ZXJuLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBuZXcgSW50ZXJhY3RpdmVQcm9jZXNzKFxuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICB0aGlzLmRpZEV4aXQuYmluZCh0aGlzKSxcbiAgICAgICAgeyBjd2QgfSxcbiAgICAgICAgZW5kUGF0dGVybixcbiAgICAgIClcbiAgICB9XG5cbiAgICBsZXQgcmVzb2x2ZVJlYWR5UHJvbWlzZVxuICAgIHRoaXMucmVhZHlQcm9taXNlID0gbmV3IFByb21pc2U8SVJlcXVlc3RSZXN1bHQ+KChyZXNvbHZlKSA9PiB7IHJlc29sdmVSZWFkeVByb21pc2UgPSByZXNvbHZlIH0pXG5cbiAgICB0aGlzLnByb2Nlc3MucmVxdWVzdChcbiAgICAgIGA6c2V0IGVkaXRvciBcXFwiJHthdG9tUGF0aH1cXFwiJHtFT0x9YCArXG4gICAgICBgOnNldCBwcm9tcHQyIFxcXCJcXFwiJHtFT0x9YCArXG4gICAgICBgOnNldCBwcm9tcHQgXFxcIlxcXFxuI35JREVIQVNLRUxMUkVQTH4lc34jXFxcXG5cXFwiJHtFT0x9YCxcbiAgICApXG4gICAgICAudGhlbihyZXNvbHZlUmVhZHlQcm9taXNlKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHdhaXRSZWFkeSgpIHtcbiAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWFkeVByb21pc2VcbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3koKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5pc0J1c3koKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIGxvYWQodXJpOiBzdHJpbmcsIGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChgOmxvYWQgJHtoc0VzY2FwZVN0cmluZyh1cmkpfSR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlbG9hZChjYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5wcm9jZXNzLnJlcXVlc3QoYDpyZWxvYWQke0VPTH1gLCBjYWxsYmFjaylcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgaWYgKGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnKSAmJiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KCdcXHgwMycpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnByb2Nlc3MuaW50ZXJydXB0KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgd3JpdGVMaW5lcyhsaW5lczogc3RyaW5nW10sIGNhbGxiYWNrPzogVExpbmVDYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLnByb2Nlc3MucmVxdWVzdChcbiAgICAgIGA6eyR7RU9MfSR7bGluZXMuam9pbihFT0wpfSR7RU9MfTp9JHtFT0x9YCxcbiAgICAgIGNhbGxiYWNrLFxuICAgIClcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVJhdyhyYXc6IHN0cmluZykge1xuICAgIHRoaXMucHJvY2Vzcy53cml0ZVN0ZGluKHJhdylcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBzZW5kQ29tcGxldGlvblJlcXVlc3QoY2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvY2Vzcy5yZXF1ZXN0KGA6Y29tcGxldGUgcmVwbCBcXFwiXFxcIiR7RU9MfWAsIGNhbGxiYWNrKVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5wcm9jZXNzLmRlc3Ryb3koKVxuICB9XG5cbiAgcHJpdmF0ZSBkaWRFeGl0KGNvZGU6IG51bWJlcikge1xuICAgIHRoaXMub25EaWRFeGl0KGNvZGUpXG4gICAgdGhpcy5kZXN0cm95KClcbiAgfVxufVxuIl19