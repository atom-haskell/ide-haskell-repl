'use babel';
import { InteractiveProcess } from './interactive-process';
import { EOL } from 'os';
import { hsEscapeString } from 'atom-haskell-utils';
export class GHCI {
    constructor(opts = {}) {
        this.splitrx = /^#~IDEHASKELLREPL~(.*)~#$/;
        let { cwd, atomPath, command, args, load, history = [] } = opts;
        this.history = {
            back: history,
            curr: '',
            item: history.length
        };
        if (process.platform === 'win32') {
            let spawnArgs = [command, ...args];
            let cmdexe = atom.config.get('ide-haskell-repl.ghciWrapperPath');
            if (cmdexe)
                spawnArgs.unshift("\"" + cmdexe + "\"");
            this.process = new InteractiveProcess("chcp 65001 && ", spawnArgs, { cwd, shell: true });
        }
        else {
            this.process = new InteractiveProcess(command, args, { cwd });
        }
        let resolveReadyPromise;
        this.readyPromise = new Promise((resolve) => { resolveReadyPromise = resolve; });
        this.process.request(`:set editor \"#{atomPath}\"${EOL}:set prompt2 \"\"${EOL}:set prompt \"\\n#~IDEHASKELLREPL~%s~#\\n\"${EOL}`)
            .then(resolveReadyPromise);
    }
    load(uri, callback) {
        return this.process.request(`:load ${hsEscapeString(uri)}${EOL}`, callback);
    }
    reload(callback) {
        return this.process.request(`:reload${EOL}`, callback);
    }
    interrupt() {
        if (this.process)
            if (atom.config.get('ide-haskell-repl.ghciWrapperPath') && process.platform === 'win32') {
                this.process.request('\x03');
            }
            else
                this.process.interrupt();
    }
    writeLines(lines, callback) {
        let text;
        if ((text = lines.join(EOL)) && this.history.back[this.history.back.length - 1] !== text)
            this.history.back.push(text);
        this.history.curr = '';
        this.history.item = this.history.back.length;
        return this.process.request(`:{${EOL}${lines.join(EOL)}${EOL}:}${EOL}`, callback);
    }
    sendCompletionRequest(callback) {
        return this.process.request(`:complete repl \"\"${EOL}`, callback);
    }
    destroy() {
        this.process.destroy();
    }
}
