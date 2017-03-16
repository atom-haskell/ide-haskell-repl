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
//# sourceMappingURL=ghci.js.map