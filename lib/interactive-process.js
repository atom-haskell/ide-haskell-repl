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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLHVDQUF1QztBQUN2QywyQkFBd0I7QUFFeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7SUFDekIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFO1FBQzdDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO0tBQzFDLENBQUMsQ0FBQTtDQUNIO0FBb0JELE1BQWEsa0JBQWtCO0lBSzdCLFlBQ0UsR0FBVyxFQUNYLElBQWMsRUFDZCxTQUF1QixFQUN2QixJQUFxQixFQUNyQixVQUFrQjtRQU5aLFdBQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFBO1FBUWpDLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUk7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FB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QU8sQ0FBQyxHQUEwQixFQUFFLE9BQXNCOztZQUN2RSxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUE7WUFDZixPQUFPLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtnQkFFdkIsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO29CQUNoQixNQUFNLElBQUksSUFBSSxDQUFBO29CQUNkLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsRUFBRTt3QkFDckIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQTt3QkFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUE7d0JBQ3hCLHNCQUFBLEtBQUssQ0FBQyxDQUFDLHlCQUFBLHNCQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUEsQ0FBQTtxQkFDWDtpQkFDRjtxQkFBTTtvQkFDTCxzQkFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUE7aUJBQzdCO2FBQ0Y7WUFDRCxJQUFJLE1BQU0sRUFBRTtnQkFDVixHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFBO2FBQ3BCO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUF0TUQsZ0RBc01DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcbmltcG9ydCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKVxuaW1wb3J0IHsgRU9MIH0gZnJvbSAnb3MnXG5cbmlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN5bWJvbCwgJ2FzeW5jSXRlcmF0b3InLCB7XG4gICAgdmFsdWU6IFN5bWJvbC5mb3IoJ1N5bWJvbC5hc3luY0l0ZXJhdG9yJyksXG4gIH0pXG59XG5cbmV4cG9ydCB0eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyKSA9PiB2b2lkXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlcXVlc3RSZXN1bHQge1xuICBzdGRvdXQ6IHN0cmluZ1tdXG4gIHN0ZGVycjogc3RyaW5nW11cbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lSU8ge1xuICB0eXBlOiAnc3RkaW4nIHwgJ3N0ZG91dCcgfCAnc3RkZXJyJ1xuICBsaW5lOiBzdHJpbmdcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVQcm9tcHQge1xuICB0eXBlOiAncHJvbXB0J1xuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCB0eXBlIFRMaW5lVHlwZSA9IElMaW5lSU8gfCBJTGluZVByb21wdFxuZXhwb3J0IHR5cGUgVExpbmVDYWxsYmFjayA9IChsaW5lOiBUTGluZVR5cGUpID0+IHZvaWRcblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlUHJvY2VzcyB7XG4gIHByaXZhdGUgcHJvY2Vzcz86IENQLkNoaWxkUHJvY2Vzc1xuICBwcml2YXRlIHJlcXVlc3RRdWV1ZTogUXVldWVcbiAgcHJpdmF0ZSBlbmRQYXR0ZXJuOiBSZWdFeHBcbiAgcHJpdmF0ZSBldmVudHMgPSBuZXcgRXZlbnRFbWl0dGVyKClcbiAgY29uc3RydWN0b3IoXG4gICAgY21kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb25EaWRFeGl0OiBFeGl0Q2FsbGJhY2ssXG4gICAgb3B0czogQ1AuU3Bhd25PcHRpb25zLFxuICAgIGVuZFBhdHRlcm46IFJlZ0V4cCxcbiAgKSB7XG4gICAgdGhpcy5lbmRQYXR0ZXJuID0gZW5kUGF0dGVyblxuICAgIHRoaXMucmVxdWVzdFF1ZXVlID0gbmV3IFF1ZXVlKDEsIDEwMClcblxuICAgIG9wdHMuc3RkaW8gPSBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ11cblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBDUC5zcGF3bihjbWQsIGFyZ3MsIG9wdHMpXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnNldE1heExpc3RlbmVycygxMDApXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnNldE1heExpc3RlbmVycygxMDApXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnNldEVuY29kaW5nKCd1dGYtOCcpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnNldEVuY29kaW5nKCd1dGYtOCcpXG5cbiAgICAgIHRoaXMucHJvY2Vzcy5vbignZXhpdCcsIChjb2RlKSA9PiB7XG4gICAgICAgIGlmIChjb2RlICE9PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignUHJvY2VzcyBleGl0ZWQgYWJub3JtYWxseScsIGNvZGUpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgICAgIG9uRGlkRXhpdChjb2RlKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICAgIHRoaXMucHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihgUHJvY2VzcyBcIiR7Y21kfVwiIGZhaWxlZCB0byBzdGFydGAsIHtcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgICBkZXRhaWw6IGVyci50b1N0cmluZygpLFxuICAgICAgICAgIHN0YWNrOiAoZXJyIGFzIEVycm9yKS5zdGFjayxcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgICAgIG9uRGlkRXhpdCgtMSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKCdFcnJvciBzcGF3bmluZyBSRVBMJywge1xuICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrLFxuICAgICAgICBkZXRhaWw6IGBUcmllZCB0byBydW4gXCIke2NtZH1cIiB3aXRoIGFyZ3VtZW50czogJHthcmdzfWAsXG4gICAgICB9KVxuICAgICAgdGhpcy5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVxdWVzdChcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgbGluZUNhbGxiYWNrPzogVExpbmVDYWxsYmFjayxcbiAgICBlbmRQYXR0ZXJuOiBSZWdFeHAgPSB0aGlzLmVuZFBhdHRlcm4sXG4gICk6IFByb21pc2U8SVJlcXVlc3RSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5wcm9jZXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3RpdmUgcHJvY2VzcyBpcyBub3QgcnVubmluZycpXG4gICAgICB9XG5cbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucGF1c2UoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5wYXVzZSgpXG5cbiAgICAgIHRoaXMud3JpdGVTdGRpbihjb21tYW5kKVxuICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3RkaW4nLCBsaW5lOiBjb21tYW5kIH0pXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlczogSVJlcXVlc3RSZXN1bHQgPSB7XG4gICAgICAgIHN0ZG91dDogW10sXG4gICAgICAgIHN0ZGVycjogW10sXG4gICAgICAgIHByb21wdDogW10sXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRW5kZWQgPSAoKSA9PiByZXMucHJvbXB0Lmxlbmd0aCA+IDAgfHwgdGhpcy5wcm9jZXNzID09PSB1bmRlZmluZWRcblxuICAgICAgY29uc3Qgc3RkRXJyTGluZSA9IChsaW5lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRlcnInLCBsaW5lIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnN0ZGVyci5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0ZGVyciA9IHRoaXMucHJvY2Vzcy5zdGRlcnJcbiAgICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiB0aGlzLnJlYWRnZW4oc3RkZXJyLCBpc0VuZGVkKSkge1xuICAgICAgICAgIHN0ZEVyckxpbmUobGluZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIHRyeSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiB0aGlzLnJlYWRnZW4odGhpcy5wcm9jZXNzLnN0ZG91dCwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gbGluZS5tYXRjaChlbmRQYXR0ZXJuKVxuICAgICAgICAgIGlmIChwYXR0ZXJuKSB7XG4gICAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdwcm9tcHQnLCBwcm9tcHQ6IHBhdHRlcm4gfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcy5wcm9tcHQgPSBwYXR0ZXJuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZG91dCcsIGxpbmUgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuICAgICAgICBjb25zdCByZXN0RXJyOiBzdHJpbmcgPSB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlYWQoKVxuICAgICAgICBpZiAocmVzdEVycikge1xuICAgICAgICAgIHJlc3RFcnIuc3BsaXQoJ1xcbicpLmZvckVhY2goc3RkRXJyTGluZSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnJlc3VtZSgpXG4gICAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucmVzdW1lKClcbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUsIHJlcylcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEVycm9yKGBQcm9jZXNzIGNyYXNoZWQgd2hpbGUgcnVubmluZyByZXF1ZXN0YCwge1xuICAgICAgICAgIGRldGFpbDogYFxcXG5zdGRlcnI6XG4ke3Jlcy5zdGRlcnIuam9pbignXFxuJyl9XG5zdGRvdXQ6XG4ke3Jlcy5zdGRvdXQuam9pbignXFxuJyl9XG5yZXF1ZXN0OlxuJHtjb21tYW5kfVxuYCxcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgICBzdGFjazogKGUgYXMgRXJyb3IpLnN0YWNrLFxuICAgICAgICB9KVxuICAgICAgICB0aHJvdyBlXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdURVJNJylcbiAgICAgIHRoaXMucHJvY2VzcyA9IHVuZGVmaW5lZFxuICAgIH1cbiAgICB0aGlzLmV2ZW50cy5lbWl0KCdkZXN0cm95ZWQnKVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNCdXN5KCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbihzdHI6IHN0cmluZykge1xuICAgIGlmICghdGhpcy5wcm9jZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgIH1cbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3YWl0UmVhZGFibGUoc3RyZWFtOiBOb2RlSlMuUmVhZGFibGVTdHJlYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnByb2Nlc3MpIHJldHVybiByZWplY3QobmV3IEVycm9yKCdObyBwcm9jZXNzJykpXG4gICAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMuZXZlbnRzLnJlbW92ZUxpc3RlbmVyKCdkZXN0cm95ZWQnLCByZWplY3RFcnJvcilcbiAgICAgICAgc3RyZWFtLnJlbW92ZUxpc3RlbmVyKCdyZWFkYWJsZScsIHJlc29sdilcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlamVjdEVycm9yID0gKCkgPT4ge1xuICAgICAgICByZW1vdmVMaXN0ZW5lcnMoKVxuICAgICAgICByZWplY3QobmV3IEVycm9yKCdQcm9jZXNzIGRlc3Ryb3llZCB3aGlsZSBhd2FpdGluZyBzdHJlYW0gcmVhZGFibGUnKSlcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc29sdiA9ICgpID0+IHtcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXJzKClcbiAgICAgICAgcmVzb2x2ZSgpXG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50cy5vbmNlKCdkZXN0cm95ZWQnLCByZWplY3RFcnJvcilcbiAgICAgIHN0cmVhbS5vbmNlKCdyZWFkYWJsZScsIHJlc29sdilcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyAqcmVhZGdlbihvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghaXNFbmRlZCgpKSB7XG4gICAgICBjb25zdCByZWFkID0gb3V0LnJlYWQoKVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1udWxsLWtleXdvcmQgc3RyaWN0LXR5cGUtcHJlZGljYXRlc1xuICAgICAgaWYgKHJlYWQgIT0gbnVsbCkge1xuICAgICAgICBidWZmZXIgKz0gcmVhZFxuICAgICAgICBpZiAoYnVmZmVyLm1hdGNoKEVPTCkpIHtcbiAgICAgICAgICBjb25zdCBhcnIgPSBidWZmZXIuc3BsaXQoRU9MKVxuICAgICAgICAgIGJ1ZmZlciA9IGFyci5wb3AoKSB8fCAnJ1xuICAgICAgICAgIHlpZWxkKiBhcnJcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgdGhpcy53YWl0UmVhZGFibGUob3V0KVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYnVmZmVyKSB7XG4gICAgICBvdXQudW5zaGlmdChidWZmZXIpXG4gICAgfVxuICB9XG59XG4iXX0=