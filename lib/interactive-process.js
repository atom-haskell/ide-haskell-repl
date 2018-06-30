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
                try {
                    for (var _a = tslib_1.__asyncValues(this.readgen(stderr, isEnded)), _b; _b = await _a.next(), !_b.done;) {
                        const line = await _b.value;
                        stdErrLine(line);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) await _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                var e_1, _c;
            });
            try {
                for (var _a = tslib_1.__asyncValues(this.readgen(this.process.stdout, isEnded)), _b; _b = await _a.next(), !_b.done;) {
                    const line = await _b.value;
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
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) await _c.call(_a);
                }
                finally { if (e_2) throw e_2.error; }
            }
            const restErr = this.process.stderr.read();
            if (restErr) {
                restErr.split('\n').forEach(stdErrLine);
            }
            this.process.stdout.resume();
            this.process.stderr.resume();
            return res;
            var e_2, _c;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLDJCQUF3QjtBQUV4QixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLGVBQWUsRUFBRTtRQUM3QyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQztLQUMxQyxDQUFDLENBQUE7QUFDSixDQUFDO0FBb0JEO0lBSUUsWUFDRSxHQUFXLEVBQ1gsSUFBYyxFQUNkLFNBQXVCLEVBQ3ZCLElBQXFCLEVBQ3JCLFVBQWtCO1FBRWxCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFB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b0JBQ2pCLE1BQU0sSUFBSSxJQUFJLENBQUE7b0JBQ2QsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3RCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBRyxDQUFDLENBQUE7d0JBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFBO3dCQUN4QixzQkFBQSxLQUFLLENBQUMsQ0FBQyx5QkFBQSxzQkFBQSxHQUFHLENBQUEsQ0FBQSxDQUFBLENBQUE7b0JBQ1osQ0FBQztnQkFDSCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLHNCQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQTtnQkFDOUIsQ0FBQztZQUNILENBQUM7WUFDRCxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNYLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDckIsQ0FBQztRQUNILENBQUM7S0FBQTtDQUNGO0FBM0pELGdEQTJKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIENQIGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgUXVldWUgPSByZXF1aXJlKCdwcm9taXNlLXF1ZXVlJylcbmltcG9ydCB0a2lsbCA9IHJlcXVpcmUoJ3RyZWUta2lsbCcpXG5pbXBvcnQgeyBFT0wgfSBmcm9tICdvcydcblxuaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3ltYm9sLCAnYXN5bmNJdGVyYXRvcicsIHtcbiAgICB2YWx1ZTogU3ltYm9sLmZvcignU3ltYm9sLmFzeW5jSXRlcmF0b3InKSxcbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXhpdENhbGxiYWNrID0gKGV4aXRDb2RlOiBudW1iZXIpID0+IHZvaWRcblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFJlc3VsdCB7XG4gIHN0ZG91dDogc3RyaW5nW11cbiAgc3RkZXJyOiBzdHJpbmdbXVxuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVJTyB7XG4gIHR5cGU6ICdzdGRpbicgfCAnc3Rkb3V0JyB8ICdzdGRlcnInXG4gIGxpbmU6IHN0cmluZ1xufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZVByb21wdCB7XG4gIHR5cGU6ICdwcm9tcHQnXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IHR5cGUgVExpbmVUeXBlID0gSUxpbmVJTyB8IElMaW5lUHJvbXB0XG5leHBvcnQgdHlwZSBUTGluZUNhbGxiYWNrID0gKGxpbmU6IFRMaW5lVHlwZSkgPT4gdm9pZFxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgcHJpdmF0ZSBwcm9jZXNzPzogQ1AuQ2hpbGRQcm9jZXNzXG4gIHByaXZhdGUgcmVxdWVzdFF1ZXVlOiBRdWV1ZVxuICBwcml2YXRlIGVuZFBhdHRlcm46IFJlZ0V4cFxuICBjb25zdHJ1Y3RvcihcbiAgICBjbWQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjayxcbiAgICBvcHRzOiBDUC5TcGF3bk9wdGlvbnMsXG4gICAgZW5kUGF0dGVybjogUmVnRXhwLFxuICApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5yZXF1ZXN0UXVldWUgPSBuZXcgUXVldWUoMSwgMTAwKVxuXG4gICAgb3B0cy5zdGRpbyA9IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXVxuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucHJvY2VzcyA9IENQLnNwYXduKGNtZCwgYXJncywgb3B0cylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0RW5jb2RpbmcoJ3V0Zi04JylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0RW5jb2RpbmcoJ3V0Zi04JylcblxuICAgICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgKGNvZGUpID0+IHtcbiAgICAgICAgb25EaWRFeGl0KGNvZGUpXG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoJ0Vycm9yIHNwYXduaW5nIFJFUEwnLCB7XG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIGRldGFpbDogYFRyaWVkIHRvIHJ1biBcIiR7Y21kfVwiIHdpdGggYXJndW1lbnRzOiAke2FyZ3N9YCxcbiAgICAgIH0pXG4gICAgICB0aGlzLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBsaW5lQ2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrLFxuICAgIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmQgfSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNFbmRlZCA9ICgpID0+IHJlcy5wcm9tcHQubGVuZ3RoID4gMFxuXG4gICAgICBjb25zdCBzdGRFcnJMaW5lID0gKGxpbmU6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGVycicsIGxpbmUgfSlcbiAgICAgICAgfVxuICAgICAgICByZXMuc3RkZXJyLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RkZXJyID0gdGhpcy5wcm9jZXNzLnN0ZGVyclxuICAgICAgc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbihzdGRlcnIsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgc3RkRXJyTGluZShsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBsaW5lLm1hdGNoKGVuZFBhdHRlcm4pXG4gICAgICAgIGlmIChwYXR0ZXJuKSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3Byb21wdCcsIHByb21wdDogcGF0dGVybiB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRvdXQnLCBsaW5lIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgIGlmIChyZXN0RXJyKSB7XG4gICAgICAgIHJlc3RFcnIuc3BsaXQoJ1xcbicpLmZvckVhY2goc3RkRXJyTGluZSlcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucmVzdW1lKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucmVzdW1lKClcbiAgICAgIHJldHVybiByZXNcbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNCdXN5KCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbihzdHI6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5wcm9jZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgIH1cbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3YWl0UmVhZGFibGUoc3RyZWFtOiBOb2RlSlMuUmVhZGFibGVTdHJlYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+XG4gICAgICBzdHJlYW0ub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUoKVxuICAgICAgfSksXG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyAqcmVhZGdlbihvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghaXNFbmRlZCgpKSB7XG4gICAgICBjb25zdCByZWFkID0gb3V0LnJlYWQoKVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1udWxsLWtleXdvcmQgc3RyaWN0LXR5cGUtcHJlZGljYXRlc1xuICAgICAgaWYgKHJlYWQgIT0gbnVsbCkge1xuICAgICAgICBidWZmZXIgKz0gcmVhZFxuICAgICAgICBpZiAoYnVmZmVyLm1hdGNoKEVPTCkpIHtcbiAgICAgICAgICBjb25zdCBhcnIgPSBidWZmZXIuc3BsaXQoRU9MKVxuICAgICAgICAgIGJ1ZmZlciA9IGFyci5wb3AoKSB8fCAnJ1xuICAgICAgICAgIHlpZWxkKiBhcnJcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0UmVhZGFibGUob3V0KVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYnVmZmVyKSB7XG4gICAgICBvdXQudW5zaGlmdChidWZmZXIpXG4gICAgfVxuICB9XG59XG4iXX0=