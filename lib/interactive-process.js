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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJhY3RpdmUtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9pbnRlcmFjdGl2ZS1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxvQ0FBbUM7QUFDbkMsdUNBQXVDO0FBQ3ZDLG1DQUFtQztBQW9CbkM7SUFLRSxZQUFhLEdBQVcsRUFBRSxJQUFjLEVBQUUsU0FBdUIsRUFBRSxJQUFxQixFQUFFLFVBQWtCO1FBQzFHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFBO1FBQzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFBO1FBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRXJDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ3hDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN4QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQTtZQUVuQixJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJO2dCQUMzQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTtnQkFDcEIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO2dCQUNmLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQTtZQUNoQixDQUFDLENBQUMsQ0FBQTtRQUNKLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2YsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBQ2hCLENBQUM7SUFDSCxDQUFDO0lBRVksT0FBTyxDQUNsQixPQUFlLEVBQUUsWUFBNEIsRUFBRSxhQUFxQixJQUFJLENBQUMsVUFBVTs7WUFFbkYsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDO2dCQUMzQixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUE7Z0JBQ3ZELENBQUM7Z0JBRUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUE7Z0JBQzNCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFBO2dCQUUzQixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFBO2dCQUN4QixFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUFBLFlBQVksQ0FBQyxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBQyxDQUFDLENBQUE7Z0JBQUEsQ0FBQztnQkFFaEUsTUFBTSxHQUFHLEdBQW1CO29CQUMxQixNQUFNLEVBQUUsRUFBRTtvQkFDVixNQUFNLEVBQUUsRUFBRTtvQkFDVixNQUFNLEVBQUUsRUFBRTtpQkFDWCxDQUFBO2dCQUVELElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQTtnQkFFakIsWUFBWSxDQUFDO29CQUNYLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQzt3QkFDZCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTt3QkFDakQsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzs0QkFBQSxZQUFZLENBQUMsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUE7d0JBQUEsQ0FBQzt3QkFDeEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7b0JBQ3ZCLENBQUM7Z0JBQ0gsQ0FBQyxDQUFBLENBQUMsQ0FBQTtnQkFFRixPQUFPLElBQUksRUFBRSxDQUFDO29CQUNaLElBQUksSUFBWSxDQUFBO29CQUNoQixJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7b0JBQzNDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUE7b0JBQ3RDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQ1osRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQzs0QkFBQSxZQUFZLENBQUMsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUFBO3dCQUFBLENBQUM7d0JBQ25FLEdBQUcsQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFBO3dCQUNwQixLQUFLLENBQUE7b0JBQ1AsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO3dCQUFBLFlBQVksQ0FBQyxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQTtvQkFBQSxDQUFDO29CQUN4RCxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtnQkFDdkIsQ0FBQztnQkFDRCxLQUFLLEdBQUcsSUFBSSxDQUFBO2dCQUNaLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFBO2dCQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtnQkFFNUIsTUFBTSxDQUFDLEdBQUcsQ0FBQTtZQUNaLENBQUMsQ0FBQSxDQUFDLENBQUE7UUFDSixDQUFDO0tBQUE7SUFFTSxPQUFPO1FBQ1osRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakIsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFBO1FBQ3BDLENBQUM7SUFDSCxDQUFDO0lBRU0sU0FBUztRQUNkLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQTtJQUNuQyxDQUFDO0lBRU8sVUFBVSxDQUFFLEdBQVc7UUFDN0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQy9CLENBQUM7SUFFYSxJQUFJLENBQUUsR0FBMEI7O1lBQzVDLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQTtZQUNmLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtnQkFDdkIsRUFBRSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xCLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7d0JBQ2xELE9BQU8sRUFBRSxDQUFBO29CQUNYLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ0wsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLElBQUksSUFBSSxDQUFBO2dCQUNoQixDQUFDO1lBQ0gsQ0FBQztZQUNELE1BQU0sQ0FBQyxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQzNDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1lBQzVCLE1BQU0sQ0FBQyxLQUFLLENBQUE7UUFDZCxDQUFDO0tBQUE7Q0FDRjtBQTlHRCxnREE4R0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBDUCBmcm9tICdjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IFF1ZXVlID0gcmVxdWlyZSgncHJvbWlzZS1xdWV1ZScpXG5pbXBvcnQgdGtpbGwgPSByZXF1aXJlKCd0cmVlLWtpbGwnKVxuXG50eXBlIEV4aXRDYWxsYmFjayA9IChleGl0Q29kZTogbnVtYmVyKSA9PiB2b2lkXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlcXVlc3RSZXN1bHQge1xuICBzdGRvdXQ6IHN0cmluZ1tdXG4gIHN0ZGVycjogc3RyaW5nW11cbiAgcHJvbXB0OiBSZWdFeHBNYXRjaEFycmF5XG59XG5leHBvcnQgaW50ZXJmYWNlIElMaW5lSU8ge1xuICB0eXBlOiAnc3RkaW4nIHwgJ3N0ZG91dCcgfCAnc3RkZXJyJ1xuICBsaW5lOiBzdHJpbmdcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmVQcm9tcHQge1xuICB0eXBlOiAncHJvbXB0J1xuICBwcm9tcHQ6IFJlZ0V4cE1hdGNoQXJyYXlcbn1cbmV4cG9ydCB0eXBlIFRMaW5lVHlwZSA9IElMaW5lSU8gfCBJTGluZVByb21wdFxuZXhwb3J0IHR5cGUgVExpbmVDYWxsYmFjayA9IChsaW5lOiBUTGluZVR5cGUpID0+IHZvaWRcblxuZXhwb3J0IGNsYXNzIEludGVyYWN0aXZlUHJvY2VzcyB7XG4gIHByaXZhdGUgcHJvY2VzczogQ1AuQ2hpbGRQcm9jZXNzXG4gIHByaXZhdGUgcmVxdWVzdFF1ZXVlOiBRdWV1ZVxuICBwcml2YXRlIGVuZFBhdHRlcm46IFJlZ0V4cFxuICBwcml2YXRlIHJ1bm5pbmc6IGJvb2xlYW5cbiAgY29uc3RydWN0b3IgKGNtZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgb25EaWRFeGl0OiBFeGl0Q2FsbGJhY2ssIG9wdHM6IENQLlNwYXduT3B0aW9ucywgZW5kUGF0dGVybjogUmVnRXhwKSB7XG4gICAgdGhpcy5lbmRQYXR0ZXJuID0gZW5kUGF0dGVyblxuICAgIHRoaXMucnVubmluZyA9IGZhbHNlXG4gICAgdGhpcy5yZXF1ZXN0UXVldWUgPSBuZXcgUXVldWUoMSwgMTAwKVxuXG4gICAgb3B0cy5zdGRpbyA9IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXVxuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucHJvY2VzcyA9IENQLnNwYXduKGNtZCwgYXJncywgb3B0cylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0TWF4TGlzdGVuZXJzKDEwMClcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRvdXQuc2V0RW5jb2RpbmcoJ3V0Zi04JylcbiAgICAgIHRoaXMucHJvY2Vzcy5zdGRlcnIuc2V0RW5jb2RpbmcoJ3V0Zi04JylcbiAgICAgIHRoaXMucnVubmluZyA9IHRydWVcblxuICAgICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgKGNvZGUpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2VcbiAgICAgICAgb25EaWRFeGl0KGNvZGUpXG4gICAgICAgIHRoaXMuZGVzdHJveSgpXG4gICAgICB9KVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXF1ZXN0IChcbiAgICBjb21tYW5kOiBzdHJpbmcsIGxpbmVDYWxsYmFjaz86IFRMaW5lQ2FsbGJhY2ssIGVuZFBhdHRlcm46IFJlZ0V4cCA9IHRoaXMuZW5kUGF0dGVybixcbiAgKTogUHJvbWlzZTxJUmVxdWVzdFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3RRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLnJ1bm5pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGl2ZSBwcm9jZXNzIGlzIG5vdCBydW5uaW5nJylcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5wYXVzZSgpXG4gICAgICB0aGlzLnByb2Nlc3Muc3RkZXJyLnBhdXNlKClcblxuICAgICAgdGhpcy53cml0ZVN0ZGluKGNvbW1hbmQpXG4gICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKHt0eXBlOiAnc3RkaW4nLCBsaW5lOiBjb21tYW5kfSl9XG5cbiAgICAgIGNvbnN0IHJlczogSVJlcXVlc3RSZXN1bHQgPSB7XG4gICAgICAgIHN0ZG91dDogW10sXG4gICAgICAgIHN0ZGVycjogW10sXG4gICAgICAgIHByb21wdDogW10sXG4gICAgICB9XG5cbiAgICAgIGxldCBlbmRlZCA9IGZhbHNlXG5cbiAgICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgICAgIHdoaWxlICghZW5kZWQpIHtcbiAgICAgICAgICBjb25zdCBsaW5lID0gYXdhaXQgdGhpcy5yZWFkKHRoaXMucHJvY2Vzcy5zdGRlcnIpXG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge2xpbmVDYWxsYmFjayh7dHlwZTogJ3N0ZGVycicsIGxpbmV9KX1cbiAgICAgICAgICByZXMuc3RkZXJyLnB1c2gobGluZSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgbGV0IGxpbmU6IHN0cmluZ1xuICAgICAgICBsaW5lID0gYXdhaXQgdGhpcy5yZWFkKHRoaXMucHJvY2Vzcy5zdGRvdXQpXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBsaW5lLm1hdGNoKGVuZFBhdHRlcm4pXG4gICAgICAgIGlmIChwYXR0ZXJuKSB7XG4gICAgICAgICAgaWYgKGxpbmVDYWxsYmFjaykge2xpbmVDYWxsYmFjayh7dHlwZTogJ3Byb21wdCcsIHByb21wdDogcGF0dGVybn0pfVxuICAgICAgICAgIHJlcy5wcm9tcHQgPSBwYXR0ZXJuXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGluZUNhbGxiYWNrKSB7bGluZUNhbGxiYWNrKHt0eXBlOiAnc3Rkb3V0JywgbGluZX0pfVxuICAgICAgICByZXMuc3Rkb3V0LnB1c2gobGluZSlcbiAgICAgIH1cbiAgICAgIGVuZGVkID0gdHJ1ZVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZG91dC5yZXN1bWUoKVxuICAgICAgdGhpcy5wcm9jZXNzLnN0ZGVyci5yZXN1bWUoKVxuXG4gICAgICByZXR1cm4gcmVzXG4gICAgfSlcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5ydW5uaW5nKSB7XG4gICAgICB0a2lsbCh0aGlzLnByb2Nlc3MucGlkLCAnU0lHVEVSTScpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgdGtpbGwodGhpcy5wcm9jZXNzLnBpZCwgJ1NJR0lOVCcpXG4gIH1cblxuICBwcml2YXRlIHdyaXRlU3RkaW4gKHN0cjogc3RyaW5nKSB7XG4gICAgdGhpcy5wcm9jZXNzLnN0ZGluLndyaXRlKHN0cilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVhZCAob3V0OiBOb2RlSlMuUmVhZGFibGVTdHJlYW0pIHtcbiAgICBsZXQgYnVmZmVyID0gJydcbiAgICB3aGlsZSAoIWJ1ZmZlci5tYXRjaCgvXFxuLykpIHtcbiAgICAgIGNvbnN0IHJlYWQgPSBvdXQucmVhZCgpXG4gICAgICBpZiAocmVhZCA9PT0gbnVsbCkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gb3V0Lm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICB9KSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1ZmZlciArPSByZWFkXG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IFtmaXJzdCwgLi4ucmVzdF0gPSBidWZmZXIuc3BsaXQoJ1xcbicpXG4gICAgb3V0LnVuc2hpZnQocmVzdC5qb2luKCdcXG4nKSlcbiAgICByZXR1cm4gZmlyc3RcbiAgfVxufVxuIl19