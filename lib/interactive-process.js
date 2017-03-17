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
                    lineCallback('stdin', command);
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
                            lineCallback('stderr', line);
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
                            lineCallback('prompt', pattern);
                        }
                        res.prompt = pattern;
                        break;
                    }
                    if (lineCallback) {
                        lineCallback('stdout', line);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxvQ0FBbUM7QUFDbkMsdUNBQXVDO0FBQ3ZDLG1DQUFtQztBQVVuQztJQUtFLFlBQWEsR0FBVyxFQUFFLElBQWMsRUFBRSxTQUF1QixFQUFFLElBQXFCLEVBQUUsVUFBa0I7UUFDMUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7UUFDNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUE7UUFDcEIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFckMsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFBO1lBRW5CLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUk7Z0JBQzNCLElBQUksQ0FBQyxPQUFPLEdB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QUM1QixNQUFNLENBQUMsS0FBSyxDQUFBO1FBQ2QsQ0FBQztLQUFBO0NBQ0Y7QUE5R0QsZ0RBOEdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQ1AgZnJvbSAnY2hpbGRfcHJvY2VzcydcbmltcG9ydCBRdWV1ZSA9IHJlcXVpcmUoJ3Byb21pc2UtcXVldWUnKVxuaW1wb3J0IHRraWxsID0gcmVxdWlyZSgndHJlZS1raWxsJylcblxudHlwZSBFeGl0Q2FsbGJhY2sgPSAoZXhpdENvZGU6IG51bWJlcikgPT4gdm9pZFxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXF1ZXN0UmVzdWx0IHtcbiAgc3Rkb3V0OiBzdHJpbmdbXVxuICBzdGRlcnI6IHN0cmluZ1tdXG4gIHByb21wdDogUmVnRXhwTWF0Y2hBcnJheVxufVxuXG5leHBvcnQgY2xhc3MgSW50ZXJhY3RpdmVQcm9jZXNzIHtcbiAgcHJpdmF0ZSBwcm9jZXNzOiBDUC5DaGlsZFByb2Nlc3NcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IFF1ZXVlXG4gIHByaXZhdGUgZW5kUGF0dGVybjogUmVnRXhwXG4gIHByaXZhdGUgcnVubmluZzogYm9vbGVhblxuICBjb25zdHJ1Y3RvciAoY21kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvbkRpZEV4aXQ6IEV4aXRDYWxsYmFjaywgb3B0czogQ1AuU3Bhd25PcHRpb25zLCBlbmRQYXR0ZXJuOiBSZWdFeHApIHtcbiAgICB0aGlzLmVuZFBhdHRlcm4gPSBlbmRQYXR0ZXJuXG4gICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICB0aGlzLnJlcXVlc3RRdWV1ZSA9IG5ldyBRdWV1ZSgxLCAxMDApXG5cbiAgICBvcHRzLnN0ZGlvID0gWydwaXBlJywgJ3BpcGUnLCAncGlwZSddXG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5wcm9jZXNzID0gQ1Auc3Bhd24oY21kLCBhcmdzLCBvcHRzKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRNYXhMaXN0ZW5lcnMoMTAwKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5zZXRFbmNvZGluZygndXRmLTgnKVxuICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZVxuXG4gICAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZVxuICAgICAgICBvbkRpZEV4aXQoY29kZSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlcXVlc3QgKFxuICAgIGNvbW1hbmQ6IHN0cmluZywgbGluZUNhbGxiYWNrPzogRnVuY3Rpb24sIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnJ1bm5pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKCdzdGRpbicsIGNvbW1hbmQpfVxuXG4gICAgICBjb25zdCByZXM6IElSZXF1ZXN0UmVzdWx0ID0ge1xuICAgICAgICBzdGRvdXQ6IFtdLFxuICAgICAgICBzdGRlcnI6IFtdLFxuICAgICAgICBwcm9tcHQ6IFtdLFxuICAgICAgfVxuXG4gICAgICBsZXQgZW5kZWQgPSBmYWxzZVxuXG4gICAgICBzZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgICAgICB3aGlsZSAoIWVuZGVkKSB7XG4gICAgICAgICAgY29uc3QgbGluZSA9IGF3YWl0IHRoaXMucmVhZCh0aGlzLnByb2Nlc3Muc3RkZXJyKVxuICAgICAgICAgIGlmIChsaW5lQ2FsbGJhY2spIHtsaW5lQ2FsbGJhY2soJ3N0ZGVycicsIGxpbmUpfVxuICAgICAgICAgIHJlcy5zdGRlcnIucHVzaChsaW5lKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBsZXQgbGluZTogc3RyaW5nXG4gICAgICAgIGxpbmUgPSBhd2FpdCB0aGlzLnJlYWQodGhpcy5wcm9jZXNzLnN0ZG91dClcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IGxpbmUubWF0Y2goZW5kUGF0dGVybilcbiAgICAgICAgaWYgKHBhdHRlcm4pIHtcbiAgICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKCdwcm9tcHQnLCBwYXR0ZXJuKX1cbiAgICAgICAgICByZXMucHJvbXB0ID0gcGF0dGVyblxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge2xpbmVDYWxsYmFjaygnc3Rkb3V0JywgbGluZSl9XG4gICAgICAgIHJlcy5zdGRvdXQucHVzaChsaW5lKVxuICAgICAgfVxuICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICB0aGlzLnByb2Nlc3Muc3Rkb3V0LnJlc3VtZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnJlc3VtZSgpXG5cbiAgICAgIHJldHVybiByZXNcbiAgICB9KVxuICB9XG5cbiAgcHVibGljIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgIHRraWxsKHRoaXMucHJvY2Vzcy5waWQsICdTSUdURVJNJylcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaW50ZXJydXB0ICgpIHtcbiAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHSU5UJylcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVTdGRpbiAoc3RyOiBzdHJpbmcpIHtcbiAgICB0aGlzLnByb2Nlc3Muc3RkaW4ud3JpdGUoc3RyKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWFkIChvdXQ6IE5vZGVKUy5SZWFkYWJsZVN0cmVhbSkge1xuICAgIGxldCBidWZmZXIgPSAnJ1xuICAgIHdoaWxlICghYnVmZmVyLm1hdGNoKC9cXG4vKSkge1xuICAgICAgY29uc3QgcmVhZCA9IG91dC5yZWFkKClcbiAgICAgIGlmIChyZWFkID09PSBudWxsKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBvdXQub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIH0pKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyICs9IHJlYWRcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgW2ZpcnN0LCAuLi5yZXN0XSA9IGJ1ZmZlci5zcGxpdCgnXFxuJylcbiAgICBvdXQudW5zaGlmdChyZXN0LmpvaW4oJ1xcbicpKVxuICAgIHJldHVybiBmaXJzdFxuICB9XG59XG4iXX0=