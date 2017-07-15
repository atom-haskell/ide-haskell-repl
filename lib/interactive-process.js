"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CP = require("child_process");
const Queue = require("promise-queue");
const tkill = require("tree-kill");
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
                let ended = false;
                const stdErrLine = (line) => {
                    if (line === undefined) {
                        return;
                    }
                    if (lineCallback) {
                        lineCallback({ type: 'stderr', line });
                    }
                    res.stderr.push(line);
                };
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    while (!ended) {
                        stdErrLine(yield this.read(this.process.stderr, () => ended));
                    }
                }));
                while (true) {
                    const line = yield this.read(this.process.stdout);
                    const pattern = line.match(endPattern);
                    if (pattern) {
                        if (lineCallback) {
                            lineCallback({ type: 'prompt', prompt: pattern });
                        }
                        res.prompt = pattern;
                        break;
                    }
                    if (lineCallback) {
                        lineCallback({ type: 'stdout', line });
                    }
                    res.stdout.push(line);
                }
                const restErr = this.process.stderr.read();
                if (restErr) {
                    restErr.split('\n').forEach(stdErrLine);
                }
                ended = true;
                this.process.stdout.resume();
                this.process.stderr.resume();
                return res;
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
    writeStdin(str) {
        this.process.stdin.write(str);
    }
    read(out, isEnded) {
        return __awaiter(this, void 0, void 0, function* () {
            let buffer = '';
            while (!buffer.match(/\n/)) {
                const read = out.read();
                if (read === null) {
                    yield new Promise((resolve) => out.once('readable', () => {
                        resolve();
                    }));
                    if (isEnded && isEnded()) {
                        if (buffer) {
                            out.unshift(buffer);
                        }
                        return;
                    }
                }
                else {
                    buffer += read;
                }
            }
            const [first, ...rest] = buffer.split('\n');
            const rev = rest.join('\n');
            if (rev) {
                out.unshift(rev);
            }
            return first;
        });
    }
}
exports.InteractiveProcess = InteractiveProcess;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxvQ0FBbUM7QUFDbkMsdUNBQXVDO0FBQ3ZDLG1DQUFtQztBQW9CbkM7SUFNRSxZQUFhLEdBQVcsRUFBRSxJQUFjLEVBQUUsU0FBdUIsRUFBRSxJQUFxQixFQUFFLFVBQWtCO1FBQzFHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQTtZQUVuQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJO2dCQUMzQixJQUFJLENBQUMsT0FBTyxH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QUFHLENBQUMsSUFBSSxFQUFFLENBQUE7Z0JBQ3ZCLEVBQUUsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNsQixNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO3dCQUNsRCxPQUFPLEVBQUUsQ0FBQTtvQkFDWCxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNILEVBQUUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3pCLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7NEJBQ1gsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTt3QkFDckIsQ0FBQzt3QkFDRCxNQUFNLENBQUE7b0JBQ1IsQ0FBQztnQkFDSCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sSUFBSSxJQUFJLENBQUE7Z0JBQ2hCLENBQUM7WUFDSCxDQUFDO1lBQ0QsTUFBTSxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDM0MsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUMzQixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUE7WUFBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUE7UUFDZCxDQUFDO0tBQUE7Q0FDRjtBQTlIRCxnREE4SEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBDUCBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IFF1ZXVlID0gcmVxdWlyZSgncHJvbWlzZS1xdWV1ZScpXG5pbXBvcnQgdGtpbGwgPSByZXF1aXJlKCd0cmVlLWtpbGwnKVxuXG50eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyKSA9PiB2b2lkXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlcXVlc3RSZXN1bHQge1xuICBzdGRvdXQ6IHN0cmluZ1tdXG4gIHN0ZGVycjogc3RyaW5nW11cbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lSU8ge1xuICB0eXBlOiAnc3RkaW4nIHwgJ3N0ZG91dCcgfCAnc3RkZXJyJ1xuICBsaW5lOiBzdHJpbmdcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVQcm9tcHQge1xuICB0eXBlOiAncHJvbXB0J1xuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCB0eXBlIFRMaW5lVHlwZSA9IElMaW5lSU8gfCBJTGluZVByb21wdFxuZXhwb3J0IHR5cGUgVExpbmVDYWxsYmFjayA9IChsaW5lOiBUTGluZVR5cGUpID0+IHZvaWRcblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlUHJvY2VzcyB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBwcm9jZXNzOiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgcnVubmluZzogYm9vbGVhblxuICBjb25zdHJ1Y3RvciAoY21kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjaywgb3B0czogQ1AuU3Bhd25PcHRpb25zLCBlbmRQYXR0ZXJuOiBSZWdFeHApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QgKFxuICAgIGNvbW1hbmQ6IHN0cmluZywgbGluZUNhbGxiYWNrPzogVExpbmVDYWxsYmFjaywgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucnVubmluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmR9KX1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgbGV0IGVuZGVkID0gZmFsc2VcblxuICAgICAgY29uc3Qgc3RkRXJyTGluZSA9IChsaW5lPzogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChsaW5lID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIH1cbiAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge2xpbmVDYWxsYmFjayh7dHlwZTogJ3N0ZGVycicsIGxpbmV9KX1cbiAgICAgICAgcmVzLnN0ZGVyci5wdXNoKGxpbmUpXG4gICAgICB9XG5cbiAgICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgICAgIHdoaWxlICghZW5kZWQpIHtcbiAgICAgICAgICBzdGRFcnJMaW5lKGF3YWl0IHRoaXMucmVhZCh0aGlzLnByb2Nlc3Muc3RkZXJyLCAoKSA9PiBlbmRlZCkpXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBhd2FpdCB0aGlzLnJlYWQodGhpcy5wcm9jZXNzLnN0ZG91dClcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKHt0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJufSl9XG4gICAgICAgICAgcmVzLnByb21wdCA9IHBhdHRlcm5cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRvdXQnLCBsaW5lfSl9XG4gICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgfVxuICAgICAgY29uc3QgcmVzdEVycjogc3RyaW5nID0gdGhpcy5wcm9jZXNzLnN0ZGVyci5yZWFkKClcbiAgICAgIGlmIChyZXN0RXJyKSB7XG4gICAgICAgIHJlc3RFcnIuc3BsaXQoJ1xcbicpLmZvckVhY2goc3RkRXJyTGluZSlcbiAgICAgIH1cbiAgICAgIGVuZGVkID0gdHJ1ZVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH0pXG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMucnVubmluZykge1xuICAgICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR1RFUk0nKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpbnRlcnJ1cHQgKCkge1xuICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdJTlQnKVxuICB9XG5cbiAgcHJpdmF0ZSB3cml0ZVN0ZGluIChzdHI6IHN0cmluZykge1xuICAgIHRoaXMucHJvY2Vzcy5zdGRpbi53cml0ZShzdHIpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlYWQgKG91dDogTm9kZUpTLlJlYWRhYmxlU3RyZWFtKTogUHJvbWlzZTxzdHJpbmc+XG4gIHByaXZhdGUgYXN5bmMgcmVhZCAob3V0OiBOb2RlSlMuUmVhZGFibGVTdHJlYW0sIGlzRW5kZWQ6ICgpID0+IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD5cbiAgcHJpdmF0ZSBhc3luYyByZWFkIChvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSwgaXNFbmRlZD86ICgpID0+IGJvb2xlYW4pIHtcbiAgICBsZXQgYnVmZmVyID0gJydcbiAgICB3aGlsZSAoIWJ1ZmZlci5tYXRjaCgvXFxuLykpIHtcbiAgICAgIGNvbnN0IHJlYWQgPSBvdXQucmVhZCgpXG4gICAgICBpZiAocmVhZCA9PT0gbnVsbCkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gb3V0Lm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICB9KSlcbiAgICAgICAgaWYgKGlzRW5kZWQgJiYgaXNFbmRlZCgpKSB7XG4gICAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgICAgb3V0LnVuc2hpZnQoYnVmZmVyKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgW2ZpcnN0LCAuLi5yZXN0XSA9IGJ1ZmZlci5zcGxpdCgnXFxuJylcbiAgICBjb25zdCByZXYgPSByZXN0LmpvaW4oJ1xcbicpXG4gICAgaWYgKHJldikgeyBvdXQudW5zaGlmdChyZXYpIH1cbiAgICByZXR1cm4gZmlyc3RcbiAgfVxufVxuIl19