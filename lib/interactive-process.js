"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const CP = require("child_process");
const Queue = require("promise-queue");
const tkill = require("tree-kill");
const os_1 = require("os");
Symbol.asyncIterator =
    Symbol.asyncIterator || Symbol.for('Symbol.asyncIterator');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLDJCQUF3QjtBQUd0QixNQUFjLENBQUMsYUFBYTtJQUM1QixNQUFNLENBQUMsYUFBYSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQTtBQWtCNUQ7SUFJRSxZQUNFLEdBQVcsRUFDWCxJQUFjLEVBQ2QsU0FBdUIsRUFDdkIsSUFBcUIsRUFDckIsVUFBa0I7UUFFbEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7UUFDNUIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBRXhDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFB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Qzt3QkFDdEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQTt3QkFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUE7d0JBQ3hCLHNCQUFBLEtBQUssQ0FBQyxDQUFDLHlCQUFBLHNCQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUEsQ0FBQTtvQkFDWixDQUFDO2dCQUNILENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sc0JBQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUNyQixDQUFDO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUEzSkQsZ0RBMkpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcbmltcG9ydCB7IEVPTCB9IGZyb20gJ29zJ1xuXG5leHBvcnQgdHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlcikgPT4gdm9pZFxuOyhTeW1ib2wgYXMgYW55KS5hc3luY0l0ZXJhdG9yID1cbiAgU3ltYm9sLmFzeW5jSXRlcmF0b3IgfHwgU3ltYm9sLmZvcignU3ltYm9sLmFzeW5jSXRlcmF0b3InKVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXF1ZXN0UmVzdWx0IHtcbiAgc3Rkb3V0OiBzdHJpbmdbXVxuICBzdGRlcnI6IHN0cmluZ1tdXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZUlPIHtcbiAgdHlwZTogJ3N0ZGluJyB8ICdzdGRvdXQnIHwgJ3N0ZGVycidcbiAgbGluZTogc3RyaW5nXG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUHJvbXB0IHtcbiAgdHlwZTogJ3Byb21wdCdcbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgdHlwZSBUTGluZVR5cGUgPSBJTGluZUlPIHwgSUxpbmVQcm9tcHRcbmV4cG9ydCB0eXBlIFRMaW5lQ2FsbGJhY2sgPSAobGluZTogVExpbmVUeXBlKSA9PiB2b2lkXG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGl2ZVByb2Nlc3Mge1xuICBwcml2YXRlIHByb2Nlc3M/OiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNtZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9uRGlkRXhpdDogRXhpdENhbGxiYWNrLFxuICAgIG9wdHM6IENQLlNwYXduT3B0aW9ucyxcbiAgICBlbmRQYXR0ZXJuOiBSZWdFeHAsXG4gICkge1xuICAgIHRoaXMuZW5kUGF0dGVybiA9IGVuZFBhdHRlcm5cbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5wcm9jZXNzID0gdW5kZWZpbmVkXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcignRXJyb3Igc3Bhd25pbmcgUkVQTCcsIHtcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICAgIHN0YWNrOiBlcnJvci5zdGFjayxcbiAgICAgICAgZGV0YWlsOiBgVHJpZWQgdG8gcnVuIFwiJHtjbWR9XCIgd2l0aCBhcmd1bWVudHM6ICR7YXJnc31gLFxuICAgICAgfSlcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssXG4gICAgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZGluJywgbGluZTogY29tbWFuZCB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBjb25zdCBpc0VuZGVkID0gKCkgPT4gcmVzLnByb21wdC5sZW5ndGggPiAwXG5cbiAgICAgIGNvbnN0IHN0ZEVyckxpbmUgPSAobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtcbiAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAnc3RkZXJyJywgbGluZSB9KVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdGRlcnIgPSB0aGlzLnByb2Nlc3Muc3RkZXJyXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHN0ZGVyciwgaXNFbmRlZCkpIHtcbiAgICAgICAgICBzdGRFcnJMaW5lKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbGluZSBvZiB0aGlzLnJlYWRnZW4odGhpcy5wcm9jZXNzLnN0ZG91dCwgaXNFbmRlZCkpIHtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICBsaW5lQ2FsbGJhY2soeyB0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJuIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5wcm9tcHQgPSBwYXR0ZXJuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgbGluZUNhbGxiYWNrKHsgdHlwZTogJ3N0ZG91dCcsIGxpbmUgfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnN0ZG91dC5wdXNoKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bnNhZmUtYW55XG4gICAgICBjb25zdCByZXN0RXJyOiBzdHJpbmcgPSB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlYWQoKVxuICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgcmVzdEVyci5zcGxpdCgnXFxuJykuZm9yRWFjaChzdGRFcnJMaW5lKVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHVEVSTScpXG4gICAgICB0aGlzLnByb2Nlc3MgPSB1bmRlZmluZWRcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0KCkge1xuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3koKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmdldFBlbmRpbmdMZW5ndGgoKSA+IDBcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVN0ZGluKHN0cjogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLnByb2Nlc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3RpdmUgcHJvY2VzcyBpcyBub3QgcnVubmluZycpXG4gICAgfVxuICAgIHRoaXMucHJvY2Vzcy5zdGRpbi53cml0ZShzdHIpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdhaXRSZWFkYWJsZShzdHJlYW06IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT5cbiAgICAgIHN0cmVhbS5vbmNlKCdyZWFkYWJsZScsICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZSgpXG4gICAgICB9KSxcbiAgICApXG4gIH1cblxuICBwcml2YXRlIGFzeW5jICpyZWFkZ2VuKG91dDogTm9kZUpTLlJlYWRhYmxlU3RyZWFtLCBpc0VuZGVkOiAoKSA9PiBib29sZWFuKSB7XG4gICAgbGV0IGJ1ZmZlciA9ICcnXG4gICAgd2hpbGUgKCFpc0VuZGVkKCkpIHtcbiAgICAgIGNvbnN0IHJlYWQgPSBvdXQucmVhZCgpXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG5vLW51bGwta2V5d29yZCBzdHJpY3QtdHlwZS1wcmVkaWNhdGVzXG4gICAgICBpZiAocmVhZCAhPSBudWxsKSB7XG4gICAgICAgIGJ1ZmZlciArPSByZWFkXG4gICAgICAgIGlmIChidWZmZXIubWF0Y2goRU9MKSkge1xuICAgICAgICAgIGNvbnN0IGFyciA9IGJ1ZmZlci5zcGxpdChFT0wpXG4gICAgICAgICAgYnVmZmVyID0gYXJyLnBvcCgpIHx8ICcnXG4gICAgICAgICAgeWllbGQqIGFyclxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCB0aGlzLndhaXRSZWFkYWJsZShvdXQpXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChidWZmZXIpIHtcbiAgICAgIG91dC51bnNoaWZ0KGJ1ZmZlcilcbiAgICB9XG4gIH1cbn1cbiJdfQ==