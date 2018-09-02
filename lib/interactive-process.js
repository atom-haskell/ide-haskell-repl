"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const CP = require("child_process");
const Queue = require("promise-queue");
const tkill = require("tree-kill");
const os_1 = require("os");
if (!Symbol.asyncIterator) {
    Object.defineProperty(Symbol, 'asyncIterator', {
        value: Symbol.for('Symbol.asyncIterator'),
    });
}
class InteractiveProcess {
    constructor(cmd, args, onDidExit, opts, endPattern) {
        this.endPattern = endPattern;
        this.requestQueue = new Queue(1, 100);
        opts.stdio = ['pipe', 'pipe', 'pipe'];
        try {
            this.process = CP.spawn(cmd, args, opts);
            this.process.stdout.setMaxListeners(100);
            this.process.stderr.setMaxListeners(100);
            this.process.stdout.setEncoding('utf-8');
            this.process.stderr.setEncoding('utf-8');
            this.process.on('exit', (code) => {
                onDidExit(code);
                this.process = undefined;
                this.destroy();
            });
        }
        catch (error) {
            atom.notifications.addFatalError('Error spawning REPL', {
                dismissable: true,
                stack: error.stack,
                detail: `Tried to run "${cmd}" with arguments: ${args}`,
            });
            this.destroy();
        }
    }
    async request(command, lineCallback, endPattern = this.endPattern) {
        return this.requestQueue.add(async () => {
            var e_1, _a;
            if (!this.process) {
                throw new Error('Interactive process is not running');
            }
            this.process.stdout.pause();
            this.process.stderr.pause();
            this.writeStdin(command);
            if (lineCallback) {
                lineCallback({ type: 'stdin', line: command });
            }
            const res = {
                stdout: [],
                stderr: [],
                prompt: [],
            };
            const isEnded = () => res.prompt.length > 0;
            const stdErrLine = (line) => {
                if (lineCallback) {
                    lineCallback({ type: 'stderr', line });
                }
                res.stderr.push(line);
            };
            const stderr = this.process.stderr;
            setImmediate(async () => {
                var e_2, _a;
                try {
                    for (var _b = tslib_1.__asyncValues(this.readgen(stderr, isEnded)), _c; _c = await _b.next(), !_c.done;) {
                        const line = _c.value;
                        stdErrLine(line);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            });
            try {
                for (var _b = tslib_1.__asyncValues(this.readgen(this.process.stdout, isEnded)), _c; _c = await _b.next(), !_c.done;) {
                    const line = _c.value;
                    const pattern = line.match(endPattern);
                    if (pattern) {
                        if (lineCallback) {
                            lineCallback({ type: 'prompt', prompt: pattern });
                        }
                        res.prompt = pattern;
                    }
                    else {
                        if (lineCallback) {
                            lineCallback({ type: 'stdout', line });
                        }
                        res.stdout.push(line);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            const restErr = this.process.stderr.read();
            if (restErr) {
                restErr.split('\n').forEach(stdErrLine);
            }
            this.process.stdout.resume();
            this.process.stderr.resume();
            return res;
        });
    }
    destroy() {
        if (this.process) {
            tkill(this.process.pid, 'SIGTERM');
            this.process = undefined;
        }
    }
    interrupt() {
        if (this.process) {
            tkill(this.process.pid, 'SIGINT');
        }
    }
    isBusy() {
        return this.requestQueue.getPendingLength() > 0;
    }
    writeStdin(str) {
        if (!this.process) {
            throw new Error('Interactive process is not running');
        }
        this.process.stdin.write(str);
    }
    async waitReadable(stream) {
        return new Promise((resolve) => stream.once('readable', () => {
            resolve();
        }));
    }
    readgen(out, isEnded) {
        return tslib_1.__asyncGenerator(this, arguments, function* readgen_1() {
            let buffer = '';
            while (!isEnded()) {
                const read = out.read();
                if (read != null) {
                    buffer += read;
                    if (buffer.match(os_1.EOL)) {
                        const arr = buffer.split(os_1.EOL);
                        buffer = arr.pop() || '';
                        yield tslib_1.__await(yield* tslib_1.__asyncDelegator(tslib_1.__asyncValues(arr)));
                    }
                }
                else {
                    yield tslib_1.__await(this.waitReadable(out));
                }
            }
            if (buffer) {
                out.unshift(buffer);
            }
        });
    }
}
exports.InteractiveProcess = InteractiveProcess;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLDJCQUF3QjtBQUV4QixJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRTtJQUN6QixNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxlQUFlLEVBQUU7UUFDN0MsS0FBSyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUM7S0FDMUMsQ0FBQyxDQUFBO0NBQ0g7QUFvQkQsTUFBYSxrQkFBa0I7SUFJN0IsWUFDRSxHQUFXLEVBQ1gsSUFBYyxFQUNkLFNBQXVCLEVBQ3ZCLElBQXFCLEVBQ3JCLFVBQWtCO1FBRWxCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUk7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMs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Q0FBQTthQUNwQjtRQUNILENBQUM7S0FBQTtDQUNGO0FBM0pELGdEQTJKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIENQIGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgUXVldWUgPSByZXF1aXJlKCdwcm9taXNlLXF1ZXVlJylcbmltcG9ydCB0a2lsbCA9IHJlcXVpcmUoJ3RyZWUta2lsbCcpXG5pbXBvcnQgeyBFT0wgfSBmcm9tICdvcydcblxuaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3ltYm9sLCAnYXN5bmNJdGVyYXRvcicsIHtcbiAgICB2YWx1ZTogU3ltYm9sLmZvcignU3ltYm9sLmFzeW5jSXRlcmF0b3InKSxcbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXhpdENhbGxiYWNrID0gKGV4aXRDb2RlOiBudW1iZXIpID0+IHZvaWRcblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFJlc3VsdCB7XG4gIHN0ZG91dDogc3RyaW5nW11cbiAgc3RkZXJyOiBzdHJpbmdbXVxuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVJTyB7XG4gIHR5cGU6ICdzdGRpbicgfCAnc3Rkb3V0JyB8ICdzdGRlcnInXG4gIGxpbmU6IHN0cmluZ1xufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZVByb21wdCB7XG4gIHR5cGU6ICdwcm9tcHQnXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IHR5cGUgVExpbmVUeXBlID0gSUxpbmVJTyB8IElMaW5lUHJvbXB0XG5leHBvcnQgdHlwZSBUTGluZUNhbGxiYWNrID0gKGxpbmU6IFRMaW5lVHlwZSkgPT4gdm9pZFxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgcHJpdmF0ZSBwcm9jZXNzPzogQ1AuQ2hpbGRQcm9jZXNzXG4gIHByaXZhdGUgcmVxdWVzdFF1ZXVlOiBRdWV1ZVxuICBwcml2YXRlIGVuZFBhdHRlcm46IFJlZ0V4cFxuICBjb25zdHJ1Y3RvcihcbiAgICBjbWQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjayxcbiAgICBvcHRzOiBDUC5TcGF3bk9wdGlvbnMsXG4gICAgZW5kUGF0dGVybjogUmVnRXhwLFxuICApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5yZXF1ZXN0UXVldWUgPSBuZXcgUXVldWUoMSwgMTAwKVxuXG4gICAgb3B0cy5zdGRpbyA9IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXVxuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucHJvY2VzcyA9IENQLnNwYXduKGNtZCwgYXJncywgb3B0cylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0RW5jb2RpbmcoJ3V0Zi04JylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0RW5jb2RpbmcoJ3V0Zi04JylcblxuICAgICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgKGNvZGUpID0+IHtcbiAgICAgICAgb25EaWRFeGl0KGNvZGUpXG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoJ0Vycm9yIHNwYXduaW5nIFJFUEwnLCB7XG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIGRldGFpbDogYFRyaWVkIHRvIHJ1biBcIiR7Y21kfVwiIHdpdGggYXJndW1lbnRzOiAke2FyZ3N9YCxcbiAgICAgIH0pXG4gICAgICB0aGlzLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBsaW5lQ2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrLFxuICAgIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmQgfSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNFbmRlZCA9ICgpID0+IHJlcy5wcm9tcHQubGVuZ3RoID4gMFxuXG4gICAgICBjb25zdCBzdGRFcnJMaW5lID0gKGxpbmU6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGVycicsIGxpbmUgfSlcbiAgICAgICAgfVxuICAgICAgICByZXMuc3RkZXJyLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RkZXJyID0gdGhpcy5wcm9jZXNzLnN0ZGVyclxuICAgICAgc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbihzdGRlcnIsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgc3RkRXJyTGluZShsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBsaW5lLm1hdGNoKGVuZFBhdHRlcm4pXG4gICAgICAgIGlmIChwYXR0ZXJuKSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3Byb21wdCcsIHByb21wdDogcGF0dGVybiB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRvdXQnLCBsaW5lIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgIGlmIChyZXN0RXJyKSB7XG4gICAgICAgIHJlc3RFcnIuc3BsaXQoJ1xcbicpLmZvckVhY2goc3RkRXJyTGluZSlcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucmVzdW1lKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucmVzdW1lKClcbiAgICAgIHJldHVybiByZXNcbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNCdXN5KCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbihzdHI6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5wcm9jZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgIH1cbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3YWl0UmVhZGFibGUoc3RyZWFtOiBOb2RlSlMuUmVhZGFibGVTdHJlYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+XG4gICAgICBzdHJlYW0ub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUoKVxuICAgICAgfSksXG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyAqcmVhZGdlbihvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghaXNFbmRlZCgpKSB7XG4gICAgICBjb25zdCByZWFkID0gb3V0LnJlYWQoKVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1udWxsLWtleXdvcmQgc3RyaWN0LXR5cGUtcHJlZGljYXRlc1xuICAgICAgaWYgKHJlYWQgIT0gbnVsbCkge1xuICAgICAgICBidWZmZXIgKz0gcmVhZFxuICAgICAgICBpZiAoYnVmZmVyLm1hdGNoKEVPTCkpIHtcbiAgICAgICAgICBjb25zdCBhcnIgPSBidWZmZXIuc3BsaXQoRU9MKVxuICAgICAgICAgIGJ1ZmZlciA9IGFyci5wb3AoKSB8fCAnJ1xuICAgICAgICAgIHlpZWxkKiBhcnJcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0UmVhZGFibGUob3V0KVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYnVmZmVyKSB7XG4gICAgICBvdXQudW5zaGlmdChidWZmZXIpXG4gICAgfVxuICB9XG59XG4iXX0=