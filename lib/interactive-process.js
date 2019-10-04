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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLHVDQUF1QztBQUN2QywyQkFBd0I7QUFFeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7SUFDekIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFO1FBQzdDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO0tBQzFDLENBQUMsQ0FBQTtDQUNIO0FBb0JELE1BQWEsa0JBQWtCO0lBSzdCLFlBQ0UsR0FBVyxFQUNYLElBQWMsRUFDZCxTQUF1QixFQUN2QixJQUFxQixFQUNyQixVQUFrQjtRQU5aLFdBQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFBO1FBUWpDLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUk7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FB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QU8sQ0FBQyxHQUEwQixFQUFFLE9BQXNCOztZQUN2RSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUE7WUFDZixPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtnQkFFdkIsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO29CQUNoQixNQUFNLElBQUksSUFBSSxDQUFBO29CQUNkLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsRUFBRTt3QkFDckIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQTt3QkFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUE7d0JBQ3hCLHNCQUFBLEtBQUssQ0FBQyxDQUFDLHlCQUFBLHNCQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUEsQ0FBQTtxQkFDWDtpQkFDRjtxQkFBTTtvQkFDTCxzQkFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUE7aUJBQzdCO2FBQ0Y7WUFDRCxJQUFJLE1BQU0sRUFBRTtnQkFDVixHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFBO2FBQ3BCO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUF0TUQsZ0RBc01DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcbmltcG9ydCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKVxuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnXG5cbmlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN5bWJvbCwgJ2FzeW5jSXRlcmF0b3InLCB7XG4gICAgdmFsdWU6IFN5bWJvbC5mb3IoJ1N5bWJvbC5hc3luY0l0ZXJhdG9yJyksXG4gIH0pXG59XG5cbmV4cG9ydCB0eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyIHwgbnVsbCkgPT4gdm9pZFxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXF1ZXN0UmVzdWx0IHtcbiAgc3Rkb3V0OiBzdHJpbmdbXVxuICBzdGRlcnI6IHN0cmluZ1tdXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZUlPIHtcbiAgdHlwZTogJ3N0ZGluJyB8ICdzdGRvdXQnIHwgJ3N0ZGVycidcbiAgbGluZTogc3RyaW5nXG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUHJvbXB0IHtcbiAgdHlwZTogJ3Byb21wdCdcbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgdHlwZSBUTGluZVR5cGUgPSBJTGluZUlPIHwgSUxpbmVQcm9tcHRcbmV4cG9ydCB0eXBlIFRMaW5lQ2FsbGJhY2sgPSAobGluZTogVExpbmVUeXBlKSA9PiB2b2lkXG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGl2ZVByb2Nlc3Mge1xuICBwcml2YXRlIHByb2Nlc3M/OiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgZXZlbnRzID0gbmV3IEV2ZW50RW1pdHRlcigpXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNtZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9uRGlkRXhpdDogRXhpdENhbGxiYWNrLFxuICAgIG9wdHM6IENQLlNwYXduT3B0aW9ucyxcbiAgICBlbmRQYXR0ZXJuOiBSZWdFeHAsXG4gICkge1xuICAgIHRoaXMuZW5kUGF0dGVybiA9IGVuZFBhdHRlcm5cbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb2Nlc3MgZXhpdGVkIGFibm9ybWFsbHknLCBjb2RlKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoYFByb2Nlc3MgXCIke2NtZH1cIiBmYWlsZWQgdG8gc3RhcnRgLCB7XG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgZGV0YWlsOiBlcnIudG9TdHJpbmcoKSxcbiAgICAgICAgICBzdGFjazogKGVyciBhcyBFcnJvcikuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgICAgICBvbkRpZEV4aXQoLTEpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcignRXJyb3Igc3Bhd25pbmcgUkVQTCcsIHtcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgZGV0YWlsOiBgVHJpZWQgdG8gcnVuIFwiJHtjbWR9XCIgd2l0aCBhcmd1bWVudHM6ICR7YXJnc31gLFxuICAgICAgfSlcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssXG4gICAgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGluJywgbGluZTogY29tbWFuZCB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0VuZGVkID0gKCkgPT4gcmVzLnByb21wdC5sZW5ndGggPiAwIHx8IHRoaXMucHJvY2VzcyA9PT0gdW5kZWZpbmVkXG5cbiAgICAgIGNvbnN0IHN0ZEVyckxpbmUgPSAobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3RkZXJyJywgbGluZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdGRlcnIgPSB0aGlzLnByb2Nlc3Muc3RkZXJyXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHN0ZGVyciwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBzdGRFcnJMaW5lKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICB0cnkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgICBpZiAocGF0dGVybikge1xuICAgICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJuIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRvdXQnLCBsaW5lIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMuc3Rkb3V0LnB1c2gobGluZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuc2FmZS1hbnlcbiAgICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgICByZXN0RXJyLnNwbGl0KCdcXG4nKS5mb3JFYWNoKHN0ZEVyckxpbmUpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlc3VtZSgpXG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlLCByZXMpXG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgUHJvY2VzcyBjcmFzaGVkIHdoaWxlIHJ1bm5pbmcgcmVxdWVzdGAsIHtcbiAgICAgICAgICBkZXRhaWw6IGBcXFxuc3RkZXJyOlxuJHtyZXMuc3RkZXJyLmpvaW4oJ1xcbicpfVxuc3Rkb3V0OlxuJHtyZXMuc3Rkb3V0LmpvaW4oJ1xcbicpfVxucmVxdWVzdDpcbiR7Y29tbWFuZH1cbmAsXG4gICAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgICAgc3RhY2s6IChlIGFzIEVycm9yKS5zdGFjayxcbiAgICAgICAgfSlcbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHVEVSTScpXG4gICAgICB0aGlzLnByb2Nlc3MgPSB1bmRlZmluZWRcbiAgICB9XG4gICAgdGhpcy5ldmVudHMuZW1pdCgnZGVzdHJveWVkJylcbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQoKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR0lOVCcpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGlzQnVzeSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UXVldWUuZ2V0UGVuZGluZ0xlbmd0aCgpID4gMFxuICB9XG5cbiAgcHVibGljIHdyaXRlU3RkaW4oc3RyOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICB9XG4gICAgdGhpcy5wcm9jZXNzLnN0ZGluLndyaXRlKHN0cilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgd2FpdFJlYWRhYmxlKHN0cmVhbTogTm9kZUpTLlJlYWRhYmxlU3RyZWFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGlmICghdGhpcy5wcm9jZXNzKSByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignTm8gcHJvY2VzcycpKVxuICAgICAgY29uc3QgcmVtb3ZlTGlzdGVuZXJzID0gKCkgPT4ge1xuICAgICAgICB0aGlzLmV2ZW50cy5yZW1vdmVMaXN0ZW5lcignZGVzdHJveWVkJywgcmVqZWN0RXJyb3IpXG4gICAgICAgIHN0cmVhbS5yZW1vdmVMaXN0ZW5lcigncmVhZGFibGUnLCByZXNvbHYpXG4gICAgICB9XG4gICAgICBjb25zdCByZWplY3RFcnJvciA9ICgpID0+IHtcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXJzKClcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignUHJvY2VzcyBkZXN0cm95ZWQgd2hpbGUgYXdhaXRpbmcgc3RyZWFtIHJlYWRhYmxlJykpXG4gICAgICB9XG4gICAgICBjb25zdCByZXNvbHYgPSAoKSA9PiB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycygpXG4gICAgICAgIHJlc29sdmUoKVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudHMub25jZSgnZGVzdHJveWVkJywgcmVqZWN0RXJyb3IpXG4gICAgICBzdHJlYW0ub25jZSgncmVhZGFibGUnLCByZXNvbHYpXG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgKnJlYWRnZW4ob3V0OiBOb2RlSlMuUmVhZGFibGVTdHJlYW0sIGlzRW5kZWQ6ICgpID0+IGJvb2xlYW4pIHtcbiAgICBsZXQgYnVmZmVyID0gJydcbiAgICB3aGlsZSAoIWlzRW5kZWQoKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tbnVsbC1rZXl3b3JkIHN0cmljdC10eXBlLXByZWRpY2F0ZXNcbiAgICAgIGlmIChyZWFkICE9IG51bGwpIHtcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgICAgaWYgKGJ1ZmZlci5tYXRjaChFT0wpKSB7XG4gICAgICAgICAgY29uc3QgYXJyID0gYnVmZmVyLnNwbGl0KEVPTClcbiAgICAgICAgICBidWZmZXIgPSBhcnIucG9wKCkgfHwgJydcbiAgICAgICAgICB5aWVsZCogYXJyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdFJlYWRhYmxlKG91dClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJ1ZmZlcikge1xuICAgICAgb3V0LnVuc2hpZnQoYnVmZmVyKVxuICAgIH1cbiAgfVxufVxuIl19