"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const CP = require("child_process");
const Queue = require("promise-queue");
const tkill = require("tree-kill");
const EventEmitter = require("events");
const os_1 = require("os");
if (!Symbol.asyncIterator) {
    Object.defineProperty(Symbol, 'asyncIterator', {
        value: Symbol.for('Symbol.asyncIterator'),
    });
}
function debug(...args) {
    if (window['atom-haskell-interactive-process-debug'] === true) {
        console.debug(...args);
    }
}
class InteractiveProcess {
    constructor(cmd, args, onDidExit, opts, endPattern) {
        this.events = new EventEmitter();
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
                if (code !== 0) {
                    console.error('Process exited abnormally', code);
                }
                this.process = undefined;
                onDidExit(code);
                this.destroy();
            });
            this.process.on('error', (err) => {
                atom.notifications.addError(`Process "${cmd}" failed to start`, {
                    dismissable: true,
                    detail: err.toString(),
                    stack: err.stack,
                });
                this.process = undefined;
                onDidExit(-1);
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
            const isEnded = () => res.prompt.length > 0 || this.process === undefined;
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
                        debug('stderr', line);
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
                try {
                    for (var _b = tslib_1.__asyncValues(this.readgen(this.process.stdout, isEnded)), _c; _c = await _b.next(), !_c.done;) {
                        const line = _c.value;
                        debug('stdout', line);
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
            }
            catch (e) {
                console.error(e, res);
                atom.notifications.addError(`Process crashed while running request`, {
                    detail: `\
stderr:
${res.stderr.join('\n')}
stdout:
${res.stdout.join('\n')}
request:
${command}
`,
                    dismissable: true,
                    stack: e.stack,
                });
                throw e;
            }
        });
    }
    destroy() {
        if (this.process) {
            tkill(this.process.pid, 'SIGTERM');
            this.process = undefined;
        }
        this.events.emit('destroyed');
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
        debug('request', str);
        this.process.stdin.write(str);
    }
    async waitReadable(stream) {
        return new Promise((resolve, reject) => {
            if (!this.process)
                return reject(new Error('No process'));
            const removeListeners = () => {
                this.events.removeListener('destroyed', rejectError);
                stream.removeListener('readable', resolv);
            };
            const rejectError = () => {
                removeListeners();
                reject(new Error('Process destroyed while awaiting stream readable'));
            };
            const resolv = () => {
                removeListeners();
                resolve();
            };
            this.events.once('destroyed', rejectError);
            stream.once('readable', resolv);
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLHVDQUF1QztBQUN2QywyQkFBd0I7QUFFeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7SUFDekIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFO1FBQzdDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO0tBQzFDLENBQUMsQ0FBQTtDQUNIO0FBb0JELFNBQVMsS0FBSyxDQUFDLEdBQUcsSUFBYztJQUM5QixJQUFJLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUM3RCxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUE7S0FDdkI7QUFDSCxDQUFDO0FBRUQsTUFBYSxrQkFBa0I7SUFLN0IsWUFDRSxHQUFXLEVBQ1gsSUFBYyxFQUNkLFNBQXVCLEVBQ3ZCLElBQXFCLEVBQ3JCLFVBQWtCO1FBTlosV0FBTSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUE7UUFRakMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7UUFDNUIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFckMsSUFBSTtZQUNGLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUs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J2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgUXVldWUgPSByZXF1aXJlKCdwcm9taXNlLXF1ZXVlJylcbmltcG9ydCB0a2lsbCA9IHJlcXVpcmUoJ3RyZWUta2lsbCcpXG5pbXBvcnQgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJylcbmltcG9ydCB7IEVPTCB9IGZyb20gJ29zJ1xuXG5pZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTeW1ib2wsICdhc3luY0l0ZXJhdG9yJywge1xuICAgIHZhbHVlOiBTeW1ib2wuZm9yKCdTeW1ib2wuYXN5bmNJdGVyYXRvcicpLFxuICB9KVxufVxuXG5leHBvcnQgdHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlciB8IG51bGwpID0+IHZvaWRcblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFJlc3VsdCB7XG4gIHN0ZG91dDogc3RyaW5nW11cbiAgc3RkZXJyOiBzdHJpbmdbXVxuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVJTyB7XG4gIHR5cGU6ICdzdGRpbicgfCAnc3Rkb3V0JyB8ICdzdGRlcnInXG4gIGxpbmU6IHN0cmluZ1xufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZVByb21wdCB7XG4gIHR5cGU6ICdwcm9tcHQnXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IHR5cGUgVExpbmVUeXBlID0gSUxpbmVJTyB8IElMaW5lUHJvbXB0XG5leHBvcnQgdHlwZSBUTGluZUNhbGxiYWNrID0gKGxpbmU6IFRMaW5lVHlwZSkgPT4gdm9pZFxuXG5mdW5jdGlvbiBkZWJ1ZyguLi5hcmdzOiBzdHJpbmdbXSkge1xuICBpZiAod2luZG93WydhdG9tLWhhc2tlbGwtaW50ZXJhY3RpdmUtcHJvY2Vzcy1kZWJ1ZyddID09PSB0cnVlKSB7XG4gICAgY29uc29sZS5kZWJ1ZyguLi5hcmdzKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGl2ZVByb2Nlc3Mge1xuICBwcml2YXRlIHByb2Nlc3M/OiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgZXZlbnRzID0gbmV3IEV2ZW50RW1pdHRlcigpXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNtZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9uRGlkRXhpdDogRXhpdENhbGxiYWNrLFxuICAgIG9wdHM6IENQLlNwYXduT3B0aW9ucyxcbiAgICBlbmRQYXR0ZXJuOiBSZWdFeHAsXG4gICkge1xuICAgIHRoaXMuZW5kUGF0dGVybiA9IGVuZFBhdHRlcm5cbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb2Nlc3MgZXhpdGVkIGFibm9ybWFsbHknLCBjb2RlKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoYFByb2Nlc3MgXCIke2NtZH1cIiBmYWlsZWQgdG8gc3RhcnRgLCB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgZGV0YWlsOiBlcnIudG9TdHJpbmcoKSxcbiAgICAgICAgICBzdGFjazogKGVyciBhcyBFcnJvcikuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoLTEpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcignRXJyb3Igc3Bhd25pbmcgUkVQTCcsIHtcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgZGV0YWlsOiBgVHJpZWQgdG8gcnVuIFwiJHtjbWR9XCIgd2l0aCBhcmd1bWVudHM6ICR7YXJnc31gLFxuICAgICAgfSlcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssXG4gICAgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGluJywgbGluZTogY29tbWFuZCB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0VuZGVkID0gKCkgPT4gcmVzLnByb21wdC5sZW5ndGggPiAwIHx8IHRoaXMucHJvY2VzcyA9PT0gdW5kZWZpbmVkXG5cbiAgICAgIGNvbnN0IHN0ZEVyckxpbmUgPSAobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3RkZXJyJywgbGluZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdGRlcnIgPSB0aGlzLnByb2Nlc3Muc3RkZXJyXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHN0ZGVyciwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBkZWJ1Zygnc3RkZXJyJywgbGluZSlcbiAgICAgICAgICBzdGRFcnJMaW5lKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICB0cnkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgZGVidWcoJ3N0ZG91dCcsIGxpbmUpXG4gICAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgICBpZiAocGF0dGVybikge1xuICAgICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJuIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRvdXQnLCBsaW5lIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMuc3Rkb3V0LnB1c2gobGluZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbiAgICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgICByZXN0RXJyLnNwbGl0KCdcXG4nKS5mb3JFYWNoKHN0ZEVyckxpbmUpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlc3VtZSgpXG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlLCByZXMpXG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgUHJvY2VzcyBjcmFzaGVkIHdoaWxlIHJ1bm5pbmcgcmVxdWVzdGAsIHtcbiAgICAgICAgICBkZXRhaWw6IGBcXFxuc3RkZXJyOlxuJHtyZXMuc3RkZXJyLmpvaW4oJ1xcbicpfVxuc3Rkb3V0OlxuJHtyZXMuc3Rkb3V0LmpvaW4oJ1xcbicpfVxucmVxdWVzdDpcbiR7Y29tbWFuZH1cbmAsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgc3RhY2s6IChlIGFzIEVycm9yKS5zdGFjayxcbiAgICAgICAgfSlcbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHVEVSTScpXG4gICAgICB0aGlzLnByb2Nlc3MgPSB1bmRlZmluZWRcbiAgICB9XG4gICAgdGhpcy5ldmVudHMuZW1pdCgnZGVzdHJveWVkJylcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR0lOVCcpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGlzQnVzeSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UXVldWUuZ2V0UGVuZGluZ0xlbmd0aCgpID4gMFxuICB9XG5cbiAgcHVibGljIHdyaXRlU3RkaW4oc3RyOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICB9XG4gICAgZGVidWcoJ3JlcXVlc3QnLCBzdHIpXG4gICAgdGhpcy5wcm9jZXNzLnN0ZGluLndyaXRlKHN0cilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgd2FpdFJlYWRhYmxlKHN0cmVhbTogTm9kZUpTLlJlYWRhYmxlU3RyZWFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghdGhpcy5wcm9jZXNzKSByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignTm8gcHJvY2VzcycpKVxuICAgICAgY29uc3QgcmVtb3ZlTGlzdGVuZXJzID0gKCkgPT4ge1xuICAgICAgICB0aGlzLmV2ZW50cy5yZW1vdmVMaXN0ZW5lcignZGVzdHJveWVkJywgcmVqZWN0RXJyb3IpXG4gICAgICAgIHN0cmVhbS5yZW1vdmVMaXN0ZW5lcigncmVhZGFibGUnLCByZXNvbHYpXG4gICAgICB9XG4gICAgICBjb25zdCByZWplY3RFcnJvciA9ICgpID0+IHtcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXJzKClcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUHJvY2VzcyBkZXN0cm95ZWQgd2hpbGUgYXdhaXRpbmcgc3RyZWFtIHJlYWRhYmxlJykpXG4gICAgICB9XG4gICAgICBjb25zdCByZXNvbHYgPSAoKSA9PiB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycygpXG4gICAgICAgIHJlc29sdmUoKVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudHMub25jZSgnZGVzdHJveWVkJywgcmVqZWN0RXJyb3IpXG4gICAgICBzdHJlYW0ub25jZSgncmVhZGFibGUnLCByZXNvbHYpXG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgKnJlYWRnZW4ob3V0OiBOb2RlSlMuUmVhZGFibGVTdHJlYW0sIGlzRW5kZWQ6ICgpID0+IGJvb2xlYW4pIHtcbiAgICBsZXQgYnVmZmVyID0gJydcbiAgICB3aGlsZSAoIWlzRW5kZWQoKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tbnVsbC1rZXl3b3JkIHN0cmljdC10eXBlLXByZWRpY2F0ZXNcbiAgICAgIGlmIChyZWFkICE9IG51bGwpIHtcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgICAgaWYgKGJ1ZmZlci5tYXRjaChFT0wpKSB7XG4gICAgICAgICAgY29uc3QgYXJyID0gYnVmZmVyLnNwbGl0KEVPTClcbiAgICAgICAgICBidWZmZXIgPSBhcnIucG9wKCkgfHwgJydcbiAgICAgICAgICB5aWVsZCogYXJyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdFJlYWRhYmxlKG91dClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJ1ZmZlcikge1xuICAgICAgb3V0LnVuc2hpZnQoYnVmZmVyKVxuICAgIH1cbiAgfVxufVxuIl19