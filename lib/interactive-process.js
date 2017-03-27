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
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    while (!ended) {
                        const line = yield this.read(this.process.stderr);
                        if (lineCallback) {
                            lineCallback({ type: 'stderr', line });
                        }
                        res.stderr.push(line);
                    }
                }));
                while (true) {
                    let line;
                    line = yield this.read(this.process.stdout);
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
    read(out) {
        return __awaiter(this, void 0, void 0, function* () {
            let buffer = '';
            while (!buffer.match(/\n/)) {
                const read = out.read();
                if (read === null) {
                    yield new Promise((resolve) => out.once('readable', () => {
                        resolve();
                    }));
                }
                else {
                    buffer += read;
                }
            }
            const [first, ...rest] = buffer.split('\n');
            out.unshift(rest.join('\n'));
            return first;
        });
    }
}
exports.InteractiveProcess = InteractiveProcess;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxvQ0FBbUM7QUFDbkMsdUNBQXVDO0FBQ3ZDLG1DQUFtQztBQW9CbkM7SUFNRSxZQUFhLEdBQVcsRUFBRSxJQUFjLEVBQUUsU0FBdUIsRUFBRSxJQUFxQixFQUFFLFVBQWtCO1FBQzFHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQTtZQUVuQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJO2dCQUMzQixJQUFJLENBQUMsT0FBTyxH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QUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzNDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1lBQzVCLE1BQU0sQ0FBQyxLQUFLLENBQUE7UUFDZCxDQUFDO0tBQUE7Q0FDRjtBQS9HRCxnREErR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBDUCBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IFF1ZXVlID0gcmVxdWlyZSgncHJvbWlzZS1xdWV1ZScpXG5pbXBvcnQgdGtpbGwgPSByZXF1aXJlKCd0cmVlLWtpbGwnKVxuXG50eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyKSA9PiB2b2lkXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlcXVlc3RSZXN1bHQge1xuICBzdGRvdXQ6IHN0cmluZ1tdXG4gIHN0ZGVycjogc3RyaW5nW11cbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lSU8ge1xuICB0eXBlOiAnc3RkaW4nIHwgJ3N0ZG91dCcgfCAnc3RkZXJyJ1xuICBsaW5lOiBzdHJpbmdcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVQcm9tcHQge1xuICB0eXBlOiAncHJvbXB0J1xuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCB0eXBlIFRMaW5lVHlwZSA9IElMaW5lSU8gfCBJTGluZVByb21wdFxuZXhwb3J0IHR5cGUgVExpbmVDYWxsYmFjayA9IChsaW5lOiBUTGluZVR5cGUpID0+IHZvaWRcblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlUHJvY2VzcyB7XG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby11bmluaXRpYWxpemVkLWNsYXNzLXByb3BlcnRpZXNcbiAgcHJpdmF0ZSBwcm9jZXNzOiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgcnVubmluZzogYm9vbGVhblxuICBjb25zdHJ1Y3RvciAoY21kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjaywgb3B0czogQ1AuU3Bhd25PcHRpb25zLCBlbmRQYXR0ZXJuOiBSZWdFeHApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QgKFxuICAgIGNvbW1hbmQ6IHN0cmluZywgbGluZUNhbGxiYWNrPzogVExpbmVDYWxsYmFjaywgZW5kUGF0dGVybjogUmVnRXhwID0gdGhpcy5lbmRQYXR0ZXJuLFxuICApOiBQcm9taXNlPElSZXF1ZXN0UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdFF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMucnVubmluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aXZlIHByb2Nlc3MgaXMgbm90IHJ1bm5pbmcnKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnBhdXNlKClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIucGF1c2UoKVxuXG4gICAgICB0aGlzLndyaXRlU3RkaW4oY29tbWFuZClcbiAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRpbicsIGxpbmU6IGNvbW1hbmR9KX1cblxuICAgICAgY29uc3QgcmVzOiBJUmVxdWVzdFJlc3VsdCA9IHtcbiAgICAgICAgc3Rkb3V0OiBbXSxcbiAgICAgICAgc3RkZXJyOiBbXSxcbiAgICAgICAgcHJvbXB0OiBbXSxcbiAgICAgIH1cblxuICAgICAgbGV0IGVuZGVkID0gZmFsc2VcblxuICAgICAgc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICAgICAgd2hpbGUgKCFlbmRlZCkge1xuICAgICAgICAgIGNvbnN0IGxpbmUgPSBhd2FpdCB0aGlzLnJlYWQodGhpcy5wcm9jZXNzLnN0ZGVycilcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKHt0eXBlOiAnc3RkZXJyJywgbGluZX0pfVxuICAgICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBsZXQgbGluZTogc3RyaW5nXG4gICAgICAgIGxpbmUgPSBhd2FpdCB0aGlzLnJlYWQodGhpcy5wcm9jZXNzLnN0ZG91dClcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKHt0eXBlOiAncHJvbXB0JywgcHJvbXB0OiBwYXR0ZXJufSl9XG4gICAgICAgICAgcmVzLnByb21wdCA9IHBhdHRlcm5cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtsaW5lQ2FsbGJhY2soe3R5cGU6ICdzdGRvdXQnLCBsaW5lfSl9XG4gICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgfVxuICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnJlc3VtZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlc3VtZSgpXG5cbiAgICAgIHJldHVybiByZXNcbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdURVJNJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVTdGRpbiAoc3RyOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWFkIChvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghYnVmZmVyLm1hdGNoKC9cXG4vKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIGlmIChyZWFkID09PSBudWxsKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBvdXQub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIH0pKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgW2ZpcnN0LCAuLi5yZXN0XSA9IGJ1ZmZlci5zcGxpdCgnXFxuJylcbiAgICBvdXQudW5zaGlmdChyZXN0LmpvaW4oJ1xcbicpKVxuICAgIHJldHVybiBmaXJzdFxuICB9XG59XG4iXX0=