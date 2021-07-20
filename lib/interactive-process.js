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
            let interval = undefined;
            try {
                interval = window.setInterval(() => process.activateUvLoop(), 100);
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
            finally {
                if (interval !== undefined)
                    window.clearInterval(interval);
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
                const err = new Error('Process destroyed while awaiting stream readable');
                err.destroyed = true;
                reject(err);
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
                    try {
                        yield tslib_1.__await(this.waitReadable(out));
                    }
                    catch (e) {
                        if (e.destroyed) {
                            console.debug(e);
                            return yield tslib_1.__await(void 0);
                        }
                    }
                }
            }
            if (buffer) {
                out.unshift(buffer);
            }
        });
    }
}
exports.InteractiveProcess = InteractiveProcess;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLHVDQUF1QztBQUN2QywyQkFBd0I7QUFFeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7SUFDekIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsZUFBZSxFQUFFO1FBQzdDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO0tBQzFDLENBQUMsQ0FBQTtDQUNIO0FBb0JELFNBQVMsS0FBSyxDQUFDLEdBQUcsSUFBYztJQUM5QixJQUFJLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQyxLQUFLLElBQUksRUFBRTtRQUM3RCxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUE7S0FDdkI7QUFDSCxDQUFDO0FBRUQsTUFBYSxrQkFBa0I7SUFLN0IsWUFDRSxHQUFXLEVBQ1gsSUFBYyxFQUNkLFNBQXVCLEVBQ3ZCLElBQXFCLEVBQ3JCLFVBQWtCO1FBTlosV0FBTSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUE7UUFRakMsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7UUFDNUIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFckMsSUFBSTtZQUNGLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUs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SyxDQUFDLENBQUMseUJBQUEsc0JBQUEsR0FBRyxDQUFBLENBQUEsQ0FBQSxDQUFBO3FCQUNYO2lCQUNGO3FCQUFNO29CQUNMLElBQUk7d0JBQ0Ysc0JBQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO3FCQUM3QjtvQkFBQyxPQUFPLENBQUMsRUFBRTt3QkFDVixJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUU7NEJBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTs0QkFDaEIscUNBQU07eUJBQ1A7cUJBQ0Y7aUJBQ0Y7YUFDRjtZQUNELElBQUksTUFBTSxFQUFFO2dCQUNWLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7YUFDcEI7UUFDSCxDQUFDO0tBQUE7Q0FDRjtBQXhORCxnREF3TkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBDUCBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IFF1ZXVlID0gcmVxdWlyZSgncHJvbWlzZS1xdWV1ZScpXG5pbXBvcnQgdGtpbGwgPSByZXF1aXJlKCd0cmVlLWtpbGwnKVxuaW1wb3J0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpXG5pbXBvcnQgeyBFT0wgfSBmcm9tICdvcydcblxuaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3ltYm9sLCAnYXN5bmNJdGVyYXRvcicsIHtcbiAgICB2YWx1ZTogU3ltYm9sLmZvcignU3ltYm9sLmFzeW5jSXRlcmF0b3InKSxcbiAgfSlcbn1cblxuZXhwb3J0IHR5cGUgRXhpdENhbGxiYWNrID0gKGV4aXRDb2RlOiBudW1iZXIgfCBudWxsKSA9PiB2b2lkXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlcXVlc3RSZXN1bHQge1xuICBzdGRvdXQ6IHN0cmluZ1tdXG4gIHN0ZGVycjogc3RyaW5nW11cbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lSU8ge1xuICB0eXBlOiAnc3RkaW4nIHwgJ3N0ZG91dCcgfCAnc3RkZXJyJ1xuICBsaW5lOiBzdHJpbmdcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVQcm9tcHQge1xuICB0eXBlOiAncHJvbXB0J1xuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCB0eXBlIFRMaW5lVHlwZSA9IElMaW5lSU8gfCBJTGluZVByb21wdFxuZXhwb3J0IHR5cGUgVExpbmVDYWxsYmFjayA9IChsaW5lOiBUTGluZVR5cGUpID0+IHZvaWRcblxuZnVuY3Rpb24gZGVidWcoLi4uYXJnczogc3RyaW5nW10pIHtcbiAgaWYgKHdpbmRvd1snYXRvbS1oYXNrZWxsLWludGVyYWN0aXZlLXByb2Nlc3MtZGVidWcnXSA9PT0gdHJ1ZSkge1xuICAgIGNvbnNvbGUuZGVidWcoLi4uYXJncylcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgcHJpdmF0ZSBwcm9jZXNzPzogQ1AuQ2hpbGRQcm9jZXNzXG4gIHByaXZhdGUgcmVxdWVzdFF1ZXVlOiBRdWV1ZVxuICBwcml2YXRlIGVuZFBhdHRlcm46IFJlZ0V4cFxuICBwcml2YXRlIGV2ZW50cyA9IG5ldyBFdmVudEVtaXR0ZXIoKVxuICBjb25zdHJ1Y3RvcihcbiAgICBjbWQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjayxcbiAgICBvcHRzOiBDUC5TcGF3bk9wdGlvbnMsXG4gICAgZW5kUGF0dGVybjogUmVnRXhwLFxuICApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5yZXF1ZXN0UXVldWUgPSBuZXcgUXVldWUoMSwgMTAwKVxuXG4gICAgb3B0cy5zdGRpbyA9IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXVxuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucHJvY2VzcyA9IENQLnNwYXduKGNtZCwgYXJncywgb3B0cylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0RW5jb2RpbmcoJ3V0Zi04JylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0RW5jb2RpbmcoJ3V0Zi04JylcblxuICAgICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgKGNvZGUpID0+IHtcbiAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdQcm9jZXNzIGV4aXRlZCBhYm5vcm1hbGx5JywgY29kZSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb2Nlc3MgPSB1bmRlZmluZWRcbiAgICAgICAgb25EaWRFeGl0KGNvZGUpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgICAgdGhpcy5wcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEVycm9yKGBQcm9jZXNzIFwiJHtjbWR9XCIgZmFpbGVkIHRvIHN0YXJ0YCwge1xuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICAgIGRldGFpbDogZXJyLnRvU3RyaW5nKCksXG4gICAgICAgICAgc3RhY2s6IChlcnIgYXMgRXJyb3IpLnN0YWNrLFxuICAgICAgICB9KVxuICAgICAgICB0aGlzLnByb2Nlc3MgPSB1bmRlZmluZWRcbiAgICAgICAgb25EaWRFeGl0KC0xKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoJ0Vycm9yIHNwYXduaW5nIFJFUEwnLCB7XG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIGRldGFpbDogYFRyaWVkIHRvIHJ1biBcIiR7Y21kfVwiIHdpdGggYXJndW1lbnRzOiAke2FyZ3N9YCxcbiAgICAgIH0pXG4gICAgICB0aGlzLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0KFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBsaW5lQ2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrLFxuICAgIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgIGxpbmVDYWxsYmFjayh7IHR5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmQgfSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNFbmRlZCA9ICgpID0+IHJlcy5wcm9tcHQubGVuZ3RoID4gMCB8fCB0aGlzLnByb2Nlc3MgPT09IHVuZGVmaW5lZFxuXG4gICAgICBjb25zdCBzdGRFcnJMaW5lID0gKGxpbmU6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGVycicsIGxpbmUgfSlcbiAgICAgICAgfVxuICAgICAgICByZXMuc3RkZXJyLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RkZXJyID0gdGhpcy5wcm9jZXNzLnN0ZGVyclxuICAgICAgc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbihzdGRlcnIsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgZGVidWcoJ3N0ZGVycicsIGxpbmUpXG4gICAgICAgICAgc3RkRXJyTGluZShsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgbGV0IGludGVydmFsID0gdW5kZWZpbmVkXG4gICAgICB0cnkge1xuICAgICAgICBpbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiBwcm9jZXNzLmFjdGl2YXRlVXZMb29wKCksIDEwMClcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbih0aGlzLnByb2Nlc3Muc3Rkb3V0LCBpc0VuZGVkKSkge1xuICAgICAgICAgIGRlYnVnKCdzdGRvdXQnLCBsaW5lKVxuICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBsaW5lLm1hdGNoKGVuZFBhdHRlcm4pXG4gICAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3Byb21wdCcsIHByb21wdDogcGF0dGVybiB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzLnByb21wdCA9IHBhdHRlcm5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3Rkb3V0JywgbGluZSB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzLnN0ZG91dC5wdXNoKGxpbmUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bnNhZmUtYW55XG4gICAgICAgIGNvbnN0IHJlc3RFcnI6IHN0cmluZyA9IHRoaXMucHJvY2Vzcy5zdGRlcnIucmVhZCgpXG4gICAgICAgIGlmIChyZXN0RXJyKSB7XG4gICAgICAgICAgcmVzdEVyci5zcGxpdCgnXFxuJykuZm9yRWFjaChzdGRFcnJMaW5lKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucmVzdW1lKClcbiAgICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuICAgICAgICByZXR1cm4gcmVzXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSwgcmVzKVxuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoYFByb2Nlc3MgY3Jhc2hlZCB3aGlsZSBydW5uaW5nIHJlcXVlc3RgLCB7XG4gICAgICAgICAgZGV0YWlsOiBgXFxcbnN0ZGVycjpcbiR7cmVzLnN0ZGVyci5qb2luKCdcXG4nKX1cbnN0ZG91dDpcbiR7cmVzLnN0ZG91dC5qb2luKCdcXG4nKX1cbnJlcXVlc3Q6XG4ke2NvbW1hbmR9XG5gLFxuICAgICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICAgIHN0YWNrOiAoZSBhcyBFcnJvcikuc3RhY2ssXG4gICAgICAgIH0pXG4gICAgICAgIHRocm93IGVcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChpbnRlcnZhbCAhPT0gdW5kZWZpbmVkKSB3aW5kb3cuY2xlYXJJbnRlcnZhbChpbnRlcnZhbClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgfVxuICAgIHRoaXMuZXZlbnRzLmVtaXQoJ2Rlc3Ryb3llZCcpXG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3koKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmdldFBlbmRpbmdMZW5ndGgoKSA+IDBcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVN0ZGluKHN0cjogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3RpdmUgcHJvY2VzcyBpcyBub3QgcnVubmluZycpXG4gICAgfVxuICAgIGRlYnVnKCdyZXF1ZXN0Jywgc3RyKVxuICAgIHRoaXMucHJvY2Vzcy5zdGRpbi53cml0ZShzdHIpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdhaXRSZWFkYWJsZShzdHJlYW06IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2VzcykgcmV0dXJuIHJlamVjdChuZXcgRXJyb3IoJ05vIHByb2Nlc3MnKSlcbiAgICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgICAgdGhpcy5ldmVudHMucmVtb3ZlTGlzdGVuZXIoJ2Rlc3Ryb3llZCcsIHJlamVjdEVycm9yKVxuICAgICAgICBzdHJlYW0ucmVtb3ZlTGlzdGVuZXIoJ3JlYWRhYmxlJywgcmVzb2x2KVxuICAgICAgfVxuICAgICAgY29uc3QgcmVqZWN0RXJyb3IgPSAoKSA9PiB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycygpXG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcbiAgICAgICAgICAnUHJvY2VzcyBkZXN0cm95ZWQgd2hpbGUgYXdhaXRpbmcgc3RyZWFtIHJlYWRhYmxlJyxcbiAgICAgICAgKSBhcyBhbnlcbiAgICAgICAgZXJyLmRlc3Ryb3llZCA9IHRydWVcbiAgICAgICAgcmVqZWN0KGVycilcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc29sdiA9ICgpID0+IHtcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXJzKClcbiAgICAgICAgcmVzb2x2ZSgpXG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50cy5vbmNlKCdkZXN0cm95ZWQnLCByZWplY3RFcnJvcilcbiAgICAgIHN0cmVhbS5vbmNlKCdyZWFkYWJsZScsIHJlc29sdilcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyAqcmVhZGdlbihvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghaXNFbmRlZCgpKSB7XG4gICAgICBjb25zdCByZWFkID0gb3V0LnJlYWQoKVxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1udWxsLWtleXdvcmQgc3RyaWN0LXR5cGUtcHJlZGljYXRlc1xuICAgICAgaWYgKHJlYWQgIT0gbnVsbCkge1xuICAgICAgICBidWZmZXIgKz0gcmVhZFxuICAgICAgICBpZiAoYnVmZmVyLm1hdGNoKEVPTCkpIHtcbiAgICAgICAgICBjb25zdCBhcnIgPSBidWZmZXIuc3BsaXQoRU9MKVxuICAgICAgICAgIGJ1ZmZlciA9IGFyci5wb3AoKSB8fCAnJ1xuICAgICAgICAgIHlpZWxkKiBhcnJcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLndhaXRSZWFkYWJsZShvdXQpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoZS5kZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoZSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYnVmZmVyKSB7XG4gICAgICBvdXQudW5zaGlmdChidWZmZXIpXG4gICAgfVxuICB9XG59XG4iXX0=