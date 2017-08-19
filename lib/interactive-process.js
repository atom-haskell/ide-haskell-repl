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
        tkill(this.process.pid, 'SIGINT');
    }
    isBusy() {
        return this.requestQueue.getPendingLength() > 0;
    }
    writeStdin(str) {
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
                    if (buffer.match(/\n/)) {
                        const arr = buffer.split('\n');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsb0NBQW1DO0FBQ25DLHVDQUF1QztBQUN2QyxtQ0FBbUM7QUFJbEMsTUFBYyxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQTtBQWtCMUY7SUFNRSxZQUFhLEdBQVcsRUFBRSxJQUFjLEVBQUUsU0FBdUIsRUFBRSxJQUFxQixFQUFFLFVBQWtCO1FBQzFHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJ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Q0FBQztLQUFBO0NBQ0Y7QUFySUQsZ0RBcUlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcblxudHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlcikgPT4gdm9pZFxuXG4oU3ltYm9sIGFzIGFueSkuYXN5bmNJdGVyYXRvciA9IFN5bWJvbC5hc3luY0l0ZXJhdG9yIHx8IFN5bWJvbC5mb3IoJ1N5bWJvbC5hc3luY0l0ZXJhdG9yJylcblxuZXhwb3J0IGludGVyZmFjZSBJUmVxdWVzdFJlc3VsdCB7XG4gIHN0ZG91dDogc3RyaW5nW11cbiAgc3RkZXJyOiBzdHJpbmdbXVxuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVJTyB7XG4gIHR5cGU6ICdzdGRpbicgfCAnc3Rkb3V0JyB8ICdzdGRlcnInXG4gIGxpbmU6IHN0cmluZ1xufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZVByb21wdCB7XG4gIHR5cGU6ICdwcm9tcHQnXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IHR5cGUgVExpbmVUeXBlID0gSUxpbmVJTyB8IElMaW5lUHJvbXB0XG5leHBvcnQgdHlwZSBUTGluZUNhbGxiYWNrID0gKGxpbmU6IFRMaW5lVHlwZSkgPT4gdm9pZFxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXVuaW5pdGlhbGl6ZWRcbiAgcHJpdmF0ZSBwcm9jZXNzOiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgcnVubmluZzogYm9vbGVhblxuICBjb25zdHJ1Y3RvciAoY21kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjaywgb3B0czogQ1AuU3Bhd25PcHRpb25zLCBlbmRQYXR0ZXJuOiBSZWdFeHApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QgKFxuICAgIGNvbW1hbmQ6IHN0cmluZywgbGluZUNhbGxiYWNrPzogVExpbmVDYWxsYmFjaywgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucnVubmluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgbGluZUNhbGxiYWNrKHt0eXBlOiAnc3RkaW4nLCBsaW5lOiBjb21tYW5kfSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNFbmRlZCA9ICgpID0+IHJlcy5wcm9tcHQubGVuZ3RoID4gMFxuXG4gICAgICBjb25zdCBzdGRFcnJMaW5lID0gKGxpbmU6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgbGluZUNhbGxiYWNrKHt0eXBlOiAnc3RkZXJyJywgbGluZX0pXG4gICAgICAgIH1cbiAgICAgICAgcmVzLnN0ZGVyci5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiB0aGlzLnJlYWRnZW4odGhpcy5wcm9jZXNzLnN0ZGVyciwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBzdGRFcnJMaW5lKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiB0aGlzLnJlYWRnZW4odGhpcy5wcm9jZXNzLnN0ZG91dCwgaXNFbmRlZCkpIHtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICBsaW5lQ2FsbGJhY2soe3R5cGU6ICdwcm9tcHQnLCBwcm9tcHQ6IHBhdHRlcm59KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGxpbmVDYWxsYmFjayh7dHlwZTogJ3N0ZG91dCcsIGxpbmV9KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXMuc3Rkb3V0LnB1c2gobGluZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgIGlmIChyZXN0RXJyKSB7XG4gICAgICAgIHJlc3RFcnIuc3BsaXQoJ1xcbicpLmZvckVhY2goc3RkRXJyTGluZSlcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQucmVzdW1lKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucmVzdW1lKClcbiAgICAgIHJldHVybiByZXNcbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdURVJNJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3kgKCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbiAoc3RyOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3YWl0UmVhZGFibGUgKHN0cmVhbTogTm9kZUpTLlJlYWRhYmxlU3RyZWFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzdHJlYW0ub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgICByZXNvbHZlKClcbiAgICB9KSlcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgKnJlYWRnZW4gKG91dDogTm9kZUpTLlJlYWRhYmxlU3RyZWFtLCBpc0VuZGVkOiAoKSA9PiBib29sZWFuKSB7XG4gICAgbGV0IGJ1ZmZlciA9ICcnXG4gICAgd2hpbGUgKCEgaXNFbmRlZCgpKSB7XG4gICAgICBjb25zdCByZWFkID0gb3V0LnJlYWQoKVxuICAgICAgaWYgKHJlYWQgIT0gbnVsbCkgeyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOiBuby1udWxsLWtleXdvcmQgc3RyaWN0LXR5cGUtcHJlZGljYXRlc1xuICAgICAgICBidWZmZXIgKz0gcmVhZFxuICAgICAgICBpZiAoYnVmZmVyLm1hdGNoKC9cXG4vKSkge1xuICAgICAgICAgIGNvbnN0IGFyciA9IGJ1ZmZlci5zcGxpdCgnXFxuJylcbiAgICAgICAgICBidWZmZXIgPSBhcnIucG9wKCkgfHwgJydcbiAgICAgICAgICB5aWVsZCogYXJyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdFJlYWRhYmxlKG91dClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJ1ZmZlcikgeyBvdXQudW5zaGlmdChidWZmZXIpIH1cbiAgfVxufVxuIl19