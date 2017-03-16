'use babel';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { hsEscapeString } from 'atom-haskell-utils';
import { EOL } from 'os';
import { InteractiveProcess } from './interactive-process';
export class GHCI {
    constructor(opts) {
        this.splitrx = /^#~IDEHASKELLREPL~(.*)~#$/;
        let { cwd, atomPath, command, args, onExit } = opts;
        this.onDidExit = onExit;
        if (process.platform === 'win32') {
            let spawnArgs = [command, ...args];
            let cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath');
            if (cmdexe) {
                spawnArgs.unshift('\"' + cmdexe + '\"');
            }
            this.process = new InteractiveProcess('chcp 65001 && ', spawnArgs, this.didExit.bind(this), { cwd, shell: true });
        }
        else {
            this.process = new InteractiveProcess(command, args, this.didExit.bind(this), { cwd });
        }
        let resolveReadyPromise;
        this.readyPromise = new Promise((resolve) => { resolveReadyPromise = resolve; });
        this.process.request(`:set editor \"#{atomPath}\"${EOL}` +
            `:set prompt2 \"\"${EOL}` +
            `:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${EOL}`)
            .then(resolveReadyPromise);
    }
    waitReady() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.readyPromise;
        });
    }
    load(uri, callback) {
        return this.process.request(`:load ${hsEscapeString(uri)}${EOL}`, callback);
    }
    reload(callback) {
        return this.process.request(`:reload${EOL}`, callback);
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
        return this.process.request(`:{${EOL}${lines.join(EOL)}${EOL}:}${EOL}`, callback);
    }
    sendCompletionRequest(callback) {
        return this.process.request(`:complete repl \"\"${EOL}`, callback);
    }
    destroy() {
        this.process.destroy();
    }
    didExit(code) {
        this.onDidExit(code);
        this.destroy();
    }
}
