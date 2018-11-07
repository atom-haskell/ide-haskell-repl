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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLHVDQUF1QztBQUN2QywyQkFBd0I7QUFFeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7SUFDekIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFO1FBQzdDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO0tBQzFDLENBQUMsQ0FBQTtDQUNIO0FBb0JELE1BQWEsa0JBQWtCO0lBSzdCLFlBQ0UsR0FBVyxFQUNYLElBQWMsRUFDZCxTQUF1QixFQUN2QixJQUFxQixFQUNyQixVQUFrQjtRQU5aLFdBQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFBO1FBUWpDLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUk7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FB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SUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFBO1lBQ2YsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFO2dCQUNqQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUE7Z0JBRXZCLElBQUksSUFBSSxJQUFJLElBQUksRUFBRTtvQkFDaEIsTUFBTSxJQUFJLElBQUksQ0FBQTtvQkFDZCxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBRyxDQUFDLEVBQUU7d0JBQ3JCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBRyxDQUFDLENBQUE7d0JBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFBO3dCQUN4QixzQkFBQSxLQUFLLENBQUMsQ0FBQyx5QkFBQSxzQkFBQSxHQUFHLENBQUEsQ0FBQSxDQUFBLENBQUE7cUJBQ1g7aUJBQ0Y7cUJBQU07b0JBQ0wsc0JBQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO2lCQUM3QjthQUNGO1lBQ0QsSUFBSSxNQUFNLEVBQUU7Z0JBQ1YsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTthQUNwQjtRQUNILENBQUM7S0FBQTtDQUNGO0FBck1ELGdEQXFNQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIENQIGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgUXVldWUgPSByZXF1aXJlKCdwcm9taXNlLXF1ZXVlJylcbmltcG9ydCB0a2lsbCA9IHJlcXVpcmUoJ3RyZWUta2lsbCcpXG5pbXBvcnQgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJylcbmltcG9ydCB7IEVPTCB9IGZyb20gJ29zJ1xuXG5pZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTeW1ib2wsICdhc3luY0l0ZXJhdG9yJywge1xuICAgIHZhbHVlOiBTeW1ib2wuZm9yKCdTeW1ib2wuYXN5bmNJdGVyYXRvcicpLFxuICB9KVxufVxuXG5leHBvcnQgdHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlcikgPT4gdm9pZFxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXF1ZXN0UmVzdWx0IHtcbiAgc3Rkb3V0OiBzdHJpbmdbXVxuICBzdGRlcnI6IHN0cmluZ1tdXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZUlPIHtcbiAgdHlwZTogJ3N0ZGluJyB8ICdzdGRvdXQnIHwgJ3N0ZGVycidcbiAgbGluZTogc3RyaW5nXG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUHJvbXB0IHtcbiAgdHlwZTogJ3Byb21wdCdcbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgdHlwZSBUTGluZVR5cGUgPSBJTGluZUlPIHwgSUxpbmVQcm9tcHRcbmV4cG9ydCB0eXBlIFRMaW5lQ2FsbGJhY2sgPSAobGluZTogVExpbmVUeXBlKSA9PiB2b2lkXG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGl2ZVByb2Nlc3Mge1xuICBwcml2YXRlIHByb2Nlc3M/OiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgZXZlbnRzID0gbmV3IEV2ZW50RW1pdHRlcigpXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNtZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9uRGlkRXhpdDogRXhpdENhbGxiYWNrLFxuICAgIG9wdHM6IENQLlNwYXduT3B0aW9ucyxcbiAgICBlbmRQYXR0ZXJuOiBSZWdFeHAsXG4gICkge1xuICAgIHRoaXMuZW5kUGF0dGVybiA9IGVuZFBhdHRlcm5cbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb2Nlc3MgZXhpdGVkIGFibm9ybWFsbHknLCBjb2RlKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoYFByb2Nlc3MgXCIke2NtZH1cIiBmYWlsZWQgdG8gc3RhcnRgLCB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgZGV0YWlsOiBlcnIudG9TdHJpbmcoKSxcbiAgICAgICAgICBzdGFjazogKGVyciBhcyBFcnJvcikuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoLTEpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcignRXJyb3Igc3Bhd25pbmcgUkVQTCcsIHtcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgZGV0YWlsOiBgVHJpZWQgdG8gcnVuIFwiJHtjbWR9XCIgd2l0aCBhcmd1bWVudHM6ICR7YXJnc31gLFxuICAgICAgfSlcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssXG4gICAgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGluJywgbGluZTogY29tbWFuZCB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0VuZGVkID0gKCkgPT4gcmVzLnByb21wdC5sZW5ndGggPiAwIHx8IHRoaXMucHJvY2VzcyA9PT0gdW5kZWZpbmVkXG5cbiAgICAgIGNvbnN0IHN0ZEVyckxpbmUgPSAobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3RkZXJyJywgbGluZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdGRlcnIgPSB0aGlzLnByb2Nlc3Muc3RkZXJyXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHN0ZGVyciwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBzdGRFcnJMaW5lKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICB0cnkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgICBpZiAocGF0dGVybikge1xuICAgICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJuIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRvdXQnLCBsaW5lIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMuc3Rkb3V0LnB1c2gobGluZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbiAgICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgICByZXN0RXJyLnNwbGl0KCdcXG4nKS5mb3JFYWNoKHN0ZEVyckxpbmUpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlc3VtZSgpXG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlLCByZXMpXG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgUHJvY2VzcyBjcmFzaGVkIHdoaWxlIHJ1bm5pbmcgcmVxdWVzdGAsIHtcbiAgICAgICAgICBkZXRhaWw6IGBcXFxuc3RkZXJyOlxuJHtyZXMuc3RkZXJyLmpvaW4oJ1xcbicpfVxuc3Rkb3V0OlxuJHtyZXMuc3Rkb3V0LmpvaW4oJ1xcbicpfVxucmVxdWVzdDpcbiR7Y29tbWFuZH1cbmAsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgfVxuICAgIHRoaXMuZXZlbnRzLmVtaXQoJ2Rlc3Ryb3llZCcpXG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3koKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmdldFBlbmRpbmdMZW5ndGgoKSA+IDBcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVN0ZGluKHN0cjogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3RpdmUgcHJvY2VzcyBpcyBub3QgcnVubmluZycpXG4gICAgfVxuICAgIHRoaXMucHJvY2Vzcy5zdGRpbi53cml0ZShzdHIpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdhaXRSZWFkYWJsZShzdHJlYW06IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2VzcykgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoJ05vIHByb2Nlc3MnKSlcbiAgICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5ldmVudHMucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIHJlamVjdEVycm9yKVxuICAgICAgICBzdHJlYW0ucmVtb3ZlTGlzdGVuZXIoJ3JlYWRhYmxlJywgcmVzb2x2KVxuICAgICAgfVxuICAgICAgY29uc3QgcmVqZWN0RXJyb3IgPSAoKSA9PiB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycygpXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1Byb2Nlc3MgZGVzdHJveWVkIHdoaWxlIGF3YWl0aW5nIHN0cmVhbSByZWFkYWJsZScpKVxuICAgICAgfVxuICAgICAgY29uc3QgcmVzb2x2ID0gKCkgPT4ge1xuICAgICAgICByZW1vdmVMaXN0ZW5lcnMoKVxuICAgICAgICByZXNvbHZlKClcbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRzLm9uY2UoJ2Rlc3Ryb3llZCcsIHJlamVjdEVycm9yKVxuICAgICAgc3RyZWFtLm9uY2UoJ3JlYWRhYmxlJywgcmVzb2x2KVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGFzeW5jICpyZWFkZ2VuKG91dDogTm9kZUpTLlJlYWRhYmxlU3RyZWFtLCBpc0VuZGVkOiAoKSA9PiBib29sZWFuKSB7XG4gICAgbGV0IGJ1ZmZlciA9ICcnXG4gICAgd2hpbGUgKCFpc0VuZGVkKCkpIHtcbiAgICAgIGNvbnN0IHJlYWQgPSBvdXQucmVhZCgpXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG5vLW51bGwta2V5d29yZCBzdHJpY3QtdHlwZS1wcmVkaWNhdGVzXG4gICAgICBpZiAocmVhZCAhPSBudWxsKSB7XG4gICAgICAgIGJ1ZmZlciArPSByZWFkXG4gICAgICAgIGlmIChidWZmZXIubWF0Y2goRU9MKSkge1xuICAgICAgICAgIGNvbnN0IGFyciA9IGJ1ZmZlci5zcGxpdChFT0wpXG4gICAgICAgICAgYnVmZmVyID0gYXJyLnBvcCgpIHx8ICcnXG4gICAgICAgICAgeWllbGQqIGFyclxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCB0aGlzLndhaXRSZWFkYWJsZShvdXQpXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChidWZmZXIpIHtcbiAgICAgIG91dC51bnNoaWZ0KGJ1ZmZlcilcbiAgICB9XG4gIH1cbn1cbiJdfQ==