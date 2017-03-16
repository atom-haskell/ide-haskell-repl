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
import Queue from 'promise-queue';
import tkill from 'tree-kill';
export class InteractiveProcess {
    constructor(cmd, args, onDidExit, opts) {
        this.endPattern = /^#~IDEHASKELLREPL~(.*)~#$/;
        this.running = false;
        this.requestQueue = new Queue(1, 100);
        opts.stdio = ['pipe', 'pipe', 'pipe'];
        try {
            this.process = CP.spawn(cmd, args, opts);
            this.process.stdout.setMaxListeners(100);
            this.process.stderr.setMaxListeners(100);
            this.process.stdout.setEncoding('utf-8');
            this.process.stderr.setEncoding('utf-8');
            this.running = true;
            this.process.on('exit', (code) => {
                this.running = false;
                onDidExit(code);
                this.destroy();
            });
        }
        catch (error) {
            this.destroy();
        }
    }
    request(command, lineCallback, linePatterns, endPattern = this.endPattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.requestQueue.add(() => __awaiter(this, void 0, void 0, function* () {
                if (!this.running) {
                    throw new Error('Interactive process is not running');
                }
                this.process.stdout.pause();
                this.process.stderr.pause();
                this.writeStdin(command);
                if (lineCallback) {
                    lineCallback('stdin', command);
                }
                let res = {
                    stdout: [],
                    stderr: [],
                };
                let ended = false;
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    while (!ended) {
                        let line = yield this.readStderr();
                        if (lineCallback) {
                            lineCallback('stderr', line);
                        }
                        res.stderr.push(line);
                    }
                }));
                while (true) {
                    let line;
                    line = yield this.readStdout(linePatterns);
                    let pattern = line.match(endPattern);
                    if (pattern) {
                        if (lineCallback) {
                            lineCallback('prompt', pattern);
                        }
                        break;
                    }
                    if (lineCallback) {
                        lineCallback('stdout', line);
                    }
                    res.stdout.push(line);
                }
                ended = true;
                this.process.stdout.resume();
                this.process.stderr.resume();
                return res;
            }));
        });
    }
    destroy() {
        if (this.running) {
            tkill(this.process.pid, 'SIGTERM');
        }
    }
    interrupt() {
        tkill(this.process.pid, 'SIGINT');
    }
    writeStdin(str) {
        this.process.stdin.write(str);
    }
    readStdout(linePatterns) {
        let { stderr = /\n/, stdout = /\n/ } = linePatterns || {};
        return this.read(this.process.stdout, /\n/);
    }
    readStderr(linePatterns) {
        let { stderr = /\n/, stdout = /\n/ } = linePatterns || {};
        return this.read(this.process.stderr, /\n/);
    }
    read(out, until) {
        return __awaiter(this, void 0, void 0, function* () {
            let buffer = '';
            while (!buffer.match(until)) {
                let read = out.read();
                if (read === null) {
                    yield new Promise((resolve) => out.once('readable', () => {
                        resolve();
                    }));
                }
                else {
                    buffer += read;
                }
            }
            let [first, ...rest] = buffer.split('\n');
            out.unshift(rest.join('\n'));
            return first;
        });
    }
}
//# sourceMappingURL=interactive-process.js.map