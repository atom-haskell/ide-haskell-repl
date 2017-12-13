"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
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
    async request(command, lineCallback, endPattern = this.endPattern) {
        return this.requestQueue.add(async () => {
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
            setImmediate(async () => {
                try {
                    for (var _a = tslib_1.__asyncValues(this.readgen(this.process.stderr, isEnded)), _b; _b = await _a.next(), !_b.done;) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUFtQztBQUNuQyx1Q0FBdUM7QUFDdkMsbUNBQW1DO0FBQ25DLDJCQUF3QjtBQUl2QixNQUFjLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxhQUFhLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO0FBa0IxRjtJQU1FLFlBQWEsR0FBVyxFQUFFLElBQWMsRUFBRSxTQUF1QixFQUFFLElBQXFCLEVBQUUsVUFBa0I7UUFDMUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7UUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUE7UUFDcEIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLEdBQUcs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Qzt3QkFDdEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFHLENBQUMsQ0FBQTt3QkFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUE7d0JBQ3hCLHNCQUFBLEtBQUssQ0FBQyxDQUFDLHlCQUFBLHNCQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUEsQ0FBQTtvQkFDWixDQUFDO2dCQUNILENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sc0JBQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQSxDQUFBO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUFDLENBQUM7UUFDckMsQ0FBQztLQUFBO0NBQ0Y7QUFqSkQsZ0RBaUpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcbmltcG9ydCB7IEVPTCB9IGZyb20gJ29zJ1xuXG50eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyKSA9PiB2b2lkXG5cbihTeW1ib2wgYXMgYW55KS5hc3luY0l0ZXJhdG9yID0gU3ltYm9sLmFzeW5jSXRlcmF0b3IgfHwgU3ltYm9sLmZvcignU3ltYm9sLmFzeW5jSXRlcmF0b3InKVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXF1ZXN0UmVzdWx0IHtcbiAgc3Rkb3V0OiBzdHJpbmdbXVxuICBzdGRlcnI6IHN0cmluZ1tdXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuZXhwb3J0IGludGVyZmFjZSBJTGluZUlPIHtcbiAgdHlwZTogJ3N0ZGluJyB8ICdzdGRvdXQnIHwgJ3N0ZGVycidcbiAgbGluZTogc3RyaW5nXG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lUHJvbXB0IHtcbiAgdHlwZTogJ3Byb21wdCdcbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgdHlwZSBUTGluZVR5cGUgPSBJTGluZUlPIHwgSUxpbmVQcm9tcHRcbmV4cG9ydCB0eXBlIFRMaW5lQ2FsbGJhY2sgPSAobGluZTogVExpbmVUeXBlKSA9PiB2b2lkXG5cbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGl2ZVByb2Nlc3Mge1xuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5pbml0aWFsaXplZFxuICBwcml2YXRlIHByb2Nlc3M6IENQLkNoaWxkUHJvY2Vzc1xuICBwcml2YXRlIHJlcXVlc3RRdWV1ZTogUXVldWVcbiAgcHJpdmF0ZSBlbmRQYXR0ZXJuOiBSZWdFeHBcbiAgcHJpdmF0ZSBydW5uaW5nOiBib29sZWFuXG4gIGNvbnN0cnVjdG9yIChjbWQ6IHN0cmluZywgYXJnczogc3RyaW5nW10sIG9uRGlkRXhpdDogRXhpdENhbGxiYWNrLCBvcHRzOiBDUC5TcGF3bk9wdGlvbnMsIGVuZFBhdHRlcm46IFJlZ0V4cCkge1xuICAgIHRoaXMuZW5kUGF0dGVybiA9IGVuZFBhdHRlcm5cbiAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgIHRoaXMucmVxdWVzdFF1ZXVlID0gbmV3IFF1ZXVlKDEsIDEwMClcblxuICAgIG9wdHMuc3RkaW8gPSBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ11cblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnByb2Nlc3MgPSBDUC5zcGF3bihjbWQsIGFyZ3MsIG9wdHMpXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnNldE1heExpc3RlbmVycygxMDApXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnNldE1heExpc3RlbmVycygxMDApXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnNldEVuY29kaW5nKCd1dGYtOCcpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnNldEVuY29kaW5nKCd1dGYtOCcpXG4gICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlXG5cbiAgICAgIHRoaXMucHJvY2Vzcy5vbignZXhpdCcsIChjb2RlKSA9PiB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlXG4gICAgICAgIG9uRGlkRXhpdChjb2RlKVxuICAgICAgICB0aGlzLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoJ0Vycm9yIHNwYXduaW5nIFJFUEwnLCB7XG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tdW5zYWZlLWFueVxuICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2ssXG4gICAgICAgIGRldGFpbDogYFRyaWVkIHRvIHJ1biBcIiR7Y21kfVwiIHdpdGggYXJndW1lbnRzOiAke2FyZ3N9YCxcbiAgICAgIH0pXG4gICAgICB0aGlzLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0IChcbiAgICBjb21tYW5kOiBzdHJpbmcsIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnJ1bm5pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgIGxpbmVDYWxsYmFjayh7dHlwZTogJ3N0ZGluJywgbGluZTogY29tbWFuZH0pXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlczogSVJlcXVlc3RSZXN1bHQgPSB7XG4gICAgICAgIHN0ZG91dDogW10sXG4gICAgICAgIHN0ZGVycjogW10sXG4gICAgICAgIHByb21wdDogW10sXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRW5kZWQgPSAoKSA9PiByZXMucHJvbXB0Lmxlbmd0aCA+IDBcblxuICAgICAgY29uc3Qgc3RkRXJyTGluZSA9IChsaW5lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgIGxpbmVDYWxsYmFjayh7dHlwZTogJ3N0ZGVycicsIGxpbmV9KVxuICAgICAgICB9XG4gICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgfVxuXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRlcnIsIGlzRW5kZWQpKSB7XG4gICAgICAgICAgc3RkRXJyTGluZShsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGxpbmUgb2YgdGhpcy5yZWFkZ2VuKHRoaXMucHJvY2Vzcy5zdGRvdXQsIGlzRW5kZWQpKSB7XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBsaW5lLm1hdGNoKGVuZFBhdHRlcm4pXG4gICAgICAgIGlmIChwYXR0ZXJuKSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge1xuICAgICAgICAgICAgbGluZUNhbGxiYWNrKHt0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJufSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnByb21wdCA9IHBhdHRlcm5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICBsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRvdXQnLCBsaW5lfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnN0ZG91dC5wdXNoKGxpbmUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bnNhZmUtYW55XG4gICAgICBjb25zdCByZXN0RXJyOiBzdHJpbmcgPSB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlYWQoKVxuICAgICAgaWYgKHJlc3RFcnIpIHtcbiAgICAgICAgcmVzdEVyci5zcGxpdCgnXFxuJykuZm9yRWFjaChzdGRFcnJMaW5lKVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0J1c3kgKCkge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5nZXRQZW5kaW5nTGVuZ3RoKCkgPiAwXG4gIH1cblxuICBwdWJsaWMgd3JpdGVTdGRpbiAoc3RyOiBzdHJpbmcpIHtcbiAgICBpZiAoIXRoaXMucnVubmluZykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICB9XG4gICAgdGhpcy5wcm9jZXNzLnN0ZGluLndyaXRlKHN0cilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgd2FpdFJlYWRhYmxlIChzdHJlYW06IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc3RyZWFtLm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgcmVzb2x2ZSgpXG4gICAgfSkpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jICpyZWFkZ2VuIChvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZDogKCkgPT4gYm9vbGVhbikge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghIGlzRW5kZWQoKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIGlmIChyZWFkICE9IG51bGwpIHsgLy8gdHNsaW50OmRpc2FibGUtbGluZTogbm8tbnVsbC1rZXl3b3JkIHN0cmljdC10eXBlLXByZWRpY2F0ZXNcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgICAgaWYgKGJ1ZmZlci5tYXRjaChFT0wpKSB7XG4gICAgICAgICAgY29uc3QgYXJyID0gYnVmZmVyLnNwbGl0KEVPTClcbiAgICAgICAgICBidWZmZXIgPSBhcnIucG9wKCkgfHwgJydcbiAgICAgICAgICB5aWVsZCogYXJyXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IHRoaXMud2FpdFJlYWRhYmxlKG91dClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJ1ZmZlcikgeyBvdXQudW5zaGlmdChidWZmZXIpIH1cbiAgfVxufVxuIl19