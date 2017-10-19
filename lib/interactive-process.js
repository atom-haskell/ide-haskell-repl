"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncIterator) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator];
    return m ? m.call(o) : typeof __values === "function" ? __values(o) : o[Symbol.iterator]();
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { if (o[n]) i[n] = function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; }; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const CP = require("child_process");
const Queue = require("promise-queue");
const tkill = require("tree-kill");
const os_1 = require("os");
Symbol.asyncIterator = Symbol.asyncIterator || Symbol.for('Symbol.asyncIterator');
class InteractiveProcess {
    constructor(cmd, args, onDidExit, opts, endPattern) {
        this.endPattern = endPattern;
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
            atom.notifications.addFatalError('Error spawning REPL', {
                dismissable: true,
                stack: error.stack,
                detail: `Tried to run "${cmd}" with arguments: ${args}`,
            });
            this.destroy();
        }
    }
    request(command, lineCallback, endPattern = this.endPattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.requestQueue.add(() => __awaiter(this, void 0, void 0, function* () {
                if (!this.running) {
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
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        for (var _a = __asyncValues(this.readgen(this.process.stderr, isEnded)), _b; _b = yield _a.next(), !_b.done;) {
                            const line = yield _b.value;
                            stdErrLine(line);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) yield _c.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    var e_1, _c;
                }));
                try {
                    for (var _a = __asyncValues(this.readgen(this.process.stdout, isEnded)), _b; _b = yield _a.next(), !_b.done;) {
                        const line = yield _b.value;
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
                        if (_b && !_b.done && (_c = _a.return)) yield _c.call(_a);
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
            }));
        });
    }
    destroy() {
        if (this.running) {
            tkill(this.process.pid, 'SIGTERM');
        }
    }
    interrupt() {
        if (this.running) {
            tkill(this.process.pid, 'SIGINT');
        }
    }
    isBusy() {
        return this.requestQueue.getPendingLength() > 0;
    }
    writeStdin(str) {
        if (!this.running) {
            throw new Error('Interactive process is not running');
        }
        this.process.stdin.write(str);
    }
    waitReadable(stream) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => stream.once('readable', () => {
                resolve();
            }));
        });
    }
    readgen(out, isEnded) {
        return __asyncGenerator(this, arguments, function* readgen_1() {
            let buffer = '';
            while (!isEnded()) {
                const read = out.read();
                if (read != null) {
                    buffer += read;
                    if (buffer.match(os_1.EOL)) {
                        const arr = buffer.split(os_1.EOL);
                        buffer = arr.pop() || '';
                        yield __await(yield* __asyncDelegator(__asyncValues(arr)));
                    }
                }
                else {
                    yield __await(this.waitReadable(out));
                }
            }
            if (buffer) {
                out.unshift(buffer);
            }
        });
    }
}
exports.InteractiveProcess = InteractiveProcess;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsb0NBQW1DO0FBQ25DLHVDQUF1QztBQUN2QyxtQ0FBbUM7QUFDbkMsMkJBQXdCO0FBSXZCLE1BQWMsQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLGFBQWEsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUE7QUFrQjFGO0lBTUUsWUFBYSxHQUFXLEVBQUUsSUFBYyxFQUFFLFNBQXVCLEVBQUUsSUFBcUIsRUFBRSxVQUFrQjtRQUMxRyxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQTtRQUM1QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTtRQUNwQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTtRQUVyQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQTtRQUVyQyxJQUFJLENBQUM7WUFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENB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TSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3RCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBRyxDQUFDLENBQUE7d0JBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFBO3dCQUN4QixjQUFBLEtBQUssQ0FBQyxDQUFDLGlCQUFBLGNBQUEsR0FBRyxDQUFBLENBQUEsQ0FBQSxDQUFBO29CQUNaLENBQUM7Z0JBQ0gsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixjQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQTtnQkFDOUIsQ0FBQztZQUNILENBQUM7WUFDRCxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFBQyxDQUFDO1FBQ3JDLENBQUM7S0FBQTtDQUNGO0FBL0lELGdEQStJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIENQIGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgUXVldWUgPSByZXF1aXJlKCdwcm9taXNlLXF1ZXVlJylcbmltcG9ydCB0a2lsbCA9IHJlcXVpcmUoJ3RyZWUta2lsbCcpXG5pbXBvcnQgeyBFT0wgfSBmcm9tICdvcydcblxudHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlcikgPT4gdm9pZFxuXG4oU3ltYm9sIGFzIGFueSkuYXN5bmNJdGVyYXRvciA9IFN5bWJvbC5hc3luY0l0ZXJhdG9yIHx8IFN5bWJvbC5mb3IoJ1N5bWJvbC5hc3luY0l0ZXJhdG9yJylcblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFJlc3VsdCB7XG4gIHN0ZG91dDogc3RyaW5nW11cbiAgc3RkZXJyOiBzdHJpbmdbXVxuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVJTyB7XG4gIHR5cGU6ICdzdGRpbicgfCAnc3Rkb3V0JyB8ICdzdGRlcnInXG4gIGxpbmU6IHN0cmluZ1xufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZVByb21wdCB7XG4gIHR5cGU6ICdwcm9tcHQnXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IHR5cGUgVExpbmVUeXBlID0gSUxpbmVJTyB8IElMaW5lUHJvbXB0XG5leHBvcnQgdHlwZSBUTGluZUNhbGxiYWNrID0gKGxpbmU6IFRMaW5lVHlwZSkgPT4gdm9pZFxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHJpdmF0ZSBwcm9jZXNzOiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgcnVubmluZzogYm9vbGVhblxuICBjb25zdHJ1Y3RvciAoY21kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjaywgb3B0czogQ1AuU3Bhd25PcHRpb25zLCBlbmRQYXR0ZXJuOiBSZWdFeHApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKCdFcnJvciBzcGF3bmluZyBSRVBMJywge1xuICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrLFxuICAgICAgICBkZXRhaWw6IGBUcmllZCB0byBydW4gXCIke2NtZH1cIiB3aXRoIGFyZ3VtZW50czogJHthcmdzfWAsXG4gICAgICB9KVxuICAgICAgdGhpcy5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVxdWVzdCAoXG4gICAgY29tbWFuZDogc3RyaW5nLCBsaW5lQ2FsbGJhY2s/OiBUTGluZUNhbGxiYWNrLCBlbmRQYXR0ZXJuOiBSZWdFeHAgPSB0aGlzLmVuZFBhdHRlcm4sXG4gICk6IFByb21pc2U8SVJlcXVlc3RSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0UXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGlmICghdGhpcy5ydW5uaW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3RpdmUgcHJvY2VzcyBpcyBub3QgcnVubmluZycpXG4gICAgICB9XG5cbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucGF1c2UoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5wYXVzZSgpXG5cbiAgICAgIHRoaXMud3JpdGVTdGRpbihjb21tYW5kKVxuICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICBsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmR9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0VuZGVkID0gKCkgPT4gcmVzLnByb21wdC5sZW5ndGggPiAwXG5cbiAgICAgIGNvbnN0IHN0ZEVyckxpbmUgPSAobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICBsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRlcnInLCBsaW5lfSlcbiAgICAgICAgfVxuICAgICAgICByZXMuc3RkZXJyLnB1c2gobGluZSlcbiAgICAgIH1cblxuICAgICAgc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbih0aGlzLnByb2Nlc3Muc3RkZXJyLCBpc0VuZGVkKSkge1xuICAgICAgICAgIHN0ZEVyckxpbmUobGluZSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgZm9yIGF3YWl0IChjb25zdCBsaW5lIG9mIHRoaXMucmVhZGdlbih0aGlzLnByb2Nlc3Muc3Rkb3V0LCBpc0VuZGVkKSkge1xuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbGluZS5tYXRjaChlbmRQYXR0ZXJuKVxuICAgICAgICBpZiAocGF0dGVybikge1xuICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7dHlwZTogJ3Byb21wdCcsIHByb21wdDogcGF0dGVybn0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5wcm9tcHQgPSBwYXR0ZXJuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgbGluZUNhbGxiYWNrKHt0eXBlOiAnc3Rkb3V0JywgbGluZX0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCByZXN0RXJyOiBzdHJpbmcgPSB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlYWQoKVxuICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgcmVzdEVyci5zcGxpdCgnXFxuJykuZm9yRWFjaChzdGRFcnJMaW5lKVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3kgKCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbiAoc3RyOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMucnVubmluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICB9XG4gICAgdGhpcy5wcm9jZXNzLnN0ZGluLndyaXRlKHN0cilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgd2FpdFJlYWRhYmxlIChzdHJlYW06IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc3RyZWFtLm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgcmVzb2x2ZSgpXG4gICAgfSkpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jICpyZWFkZ2VuIChvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghIGlzRW5kZWQoKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIGlmIChyZWFkICE9IG51bGwpIHsgLy8gdHNsaW50OmRpc2FibGUtbGluZTogbm8tbnVsbC1rZXl3b3JkIHN0cmljdC10eXBlLXByZWRpY2F0ZXNcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgICAgaWYgKGJ1ZmZlci5tYXRjaChFT0wpKSB7XG4gICAgICAgICAgY29uc3QgYXJyID0gYnVmZmVyLnNwbGl0KEVPTClcbiAgICAgICAgICBidWZmZXIgPSBhcnIucG9wKCkgfHwgJydcbiAgICAgICAgICB5aWVsZCogYXJyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdFJlYWRhYmxlKG91dClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJ1ZmZlcikgeyBvdXQudW5zaGlmdChidWZmZXIpIH1cbiAgfVxufVxuIl19