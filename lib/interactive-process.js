'use babel';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as CP from 'child_process';
export class InteractiveProcess {
    constructor(cmd, args = [], opts = {}) {
        this.endPattern = /^#~IDEHASKELLREPL~(.*)~#$/;
        opts.stdio = ['pipe', 'pipe', 'pipe'];
        this.currentRequestPromise = Promise.resolve();
        const handleError = (error) => {
            this.destroy();
        };
        try {
            this.process = CP.spawn(cmd, args, opts);
            this.process.on('exit', (code) => {
                if (code !== 0) {
                    handleError(new Error('non-zero exit code'));
                }
                this.destroy();
            });
        }
        catch (error) {
            handleError(error);
        }
    }
    request(command, lineCallback, endPattern = this.endPattern) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.currentRequestPromise;
            let doResolve;
            this.currentRequestPromise = new Promise((resolve) => { doResolve = resolve; });
            this.process.stdout.pause();
            this.process.stderr.pause();
            this.writeStdin(command);
            if (lineCallback)
                lineCallback('stdin', command);
            let res = {
                stdout: [],
                stderr: []
            };
            while (true) {
                let name, line;
                [name, line] = yield this.readBoth();
                let pattern = line.match(endPattern);
                if (name === 'stdout' && pattern) {
                    if (lineCallback)
                        lineCallback('prompt', pattern);
                    break;
                }
                if (lineCallback)
                    lineCallback(name, line);
                res[name].push(line);
            }
            this.process.stdout.resume();
            this.process.stderr.resume();
            doResolve();
            console.error(res);
            return res;
        });
    }
    writeStdin(str) {
        this.process.stdin.write(str);
    }
    readBoth() {
        return Promise.race([
            this.read('stdout', this.process.stdout),
            this.read('stderr', this.process.stderr)
        ]);
    }
    read(name, out) {
        return __awaiter(this, void 0, void 0, function* () {
            let buffer = "";
            while (!buffer.match(/\n/)) {
                if (!out.readable)
                    yield new Promise((resolve) => out.once('readable', resolve));
                let read = out.read();
                if (read === null)
                    yield new Promise((resolve) => out.once('readable', resolve));
                else
                    buffer += read;
            }
            let [first, ...rest] = buffer.split('\n');
            out.unshift(rest.join('\n'));
            return [name, first];
        });
    }
    destroy() { }
    interrupt() { }
}
