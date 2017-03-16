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
const Util = require("atom-haskell-utils");
const fuzzaldrin_1 = require("fuzzaldrin");
const command_history_1 = require("./command-history");
const ghci_1 = require("./ghci");
class IdeHaskellReplBase {
    constructor(upiPromise, { uri, content, history, autoReloadRepeat = atom.config.get('ide-haskell-repl.autoReloadRepeat'), }) {
        this.uri = uri;
        this.history = new command_history_1.CommandHistory(history);
        this._autoReloadRepeat = autoReloadRepeat;
        this.errors = [];
        this.messages = content || [];
        setImmediate(() => __awaiter(this, void 0, void 0, function* () { return this.initialize(upiPromise); }));
    }
    toggleAutoReloadRepeat() {
        this.autoReloadRepeat = !this.autoReloadRepeat;
    }
    runCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            let inp = command.split('\n');
            let res = yield this.ghci.writeLines(inp, (type, text) => {
                console.error(type, text);
                switch (type) {
                    case 'stdin':
                        text && this.messages.push({ text: inp.join('\n'), hl: true, cls: 'ide-haskell-repl-input-text' });
                        break;
                    case 'stdout':
                        text && this.messages.push({ text, hl: true, cls: 'ide-haskell-repl-output-text' });
                        break;
                    case 'prompt':
                        this.prompt = text[1];
                        break;
                    default: break;
                }
                this.update();
            });
            this.errorsFromStderr(res.stderr);
            return res;
        });
    }
    ghciReload() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.ghci.reload();
        });
    }
    ghciReloadRepeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let { stderr } = yield this.ghci.reload();
            if (!this.errorsFromStderr(stderr)) {
                let command = this.history.goBack('');
                return this.runCommand(command);
            }
        });
    }
    set autoReloadRepeat(autoReloadRepeat) {
        this._autoReloadRepeat = autoReloadRepeat;
        this.update();
    }
    get autoReloadRepeat() {
        return this._autoReloadRepeat;
    }
    interrupt() {
        this.ghci.interrupt();
    }
    getCompletions(prefix) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!prefix.trim()) {
                return [];
            }
            let { stdout } = yield this.ghci.sendCompletionRequest();
            stdout.shift();
            return fuzzaldrin_1.filter(stdout, prefix).map((text) => ({ text: text.slice(1, -1) }));
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ghci) {
                this.ghci.destroy();
            }
        });
    }
    initialize(upiPromise) {
        return __awaiter(this, void 0, void 0, function* () {
            this.upi = yield upiPromise;
            if (!this.upi) {
                return this.runREPL(null);
            }
            try {
                let builder = yield this.upi.params.get('ide-haskell-cabal', 'builder');
                this.runREPL((builder || {}).name);
            }
            catch (error) {
                if (error) {
                    atom.notifications.addFatalError(error.toString(), {
                        detail: error,
                        dismissable: true,
                    });
                    this.destroy();
                }
                else {
                    atom.notifications.addWarning("Can't run REPL without knowing what builder to use");
                    this.destroy();
                }
            }
        });
    }
    runREPL(builder) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!builder) {
                builder = atom.config.get('ide-haskell-repl.defaultRepl');
            }
            let subst = {
                'nix-build': 'cabal',
                'none': 'ghci',
            };
            builder = (subst[builder] || builder);
            this.cwd = Util.getRootDir(this.uri);
            let [cabalFile] = this.cwd.getEntriesSync().filter((file) => file.isFile() && file.getBaseName().endsWith('.cabal'));
            let cabal, comp;
            if (cabalFile) {
                let cabalContents = cabalFile.readSync();
                cabal = Util.parseDotCabalSync(cabalContents)[comp] = Util.getComponentFromFileSync(cabalContents, this.cwd.relativize(this.uri));
            }
            let commandPath = atom.config.get(`ide-haskell-repl.${builder}Path`);
            let args = {
                stack: ['ghci'],
                cabal: ['repl'],
                ghci: [],
            };
            let extraArgs = {
                stack: (x) => '--ghci-options="#{x}"',
                cabal: (x) => '--ghc-option=#{x}',
                ghci: (x) => x,
            };
            if (!args[builder]) {
                throw new Error('Unknown builder #{builder}');
            }
            let commandArgs = args[builder];
            commandArgs.push(...(atom.config.get('ide-haskell-repl.extraArgs').map(extraArgs[builder])));
            if (comp) {
                if (builder === 'stack') {
                    if (comp.startsWith('lib:')) {
                        comp = 'lib';
                    }
                    comp = `${cabal.name}:${comp}`;
                    commandArgs.push('--main-is', comp);
                }
                else {
                    commandArgs.push(comp);
                }
            }
            this.ghci = new ghci_1.GHCI({
                atomPath: process.execPath,
                command: commandPath,
                args: commandArgs,
                cwd: this.cwd.getPath(),
                onExit: (code) => __awaiter(this, void 0, void 0, function* () { return this.destroy(); }),
            });
            yield this.ghci.waitReady();
            this.ghci.load(this.uri, (type, text) => {
                if (type === 'prompt') {
                    this.prompt = text[1];
                    this.update();
                }
            });
        });
    }
    errorsFromStderr(stderr) {
        this.errors = this.errors.filter(({ _time }) => Date.now() - _time < 10000);
        let hasErrors = false;
        for (let err of stderr.join('\n').split(/\n(?=\S)/)) {
            if (err) {
                let error = this.parseMessage(err);
                this.errors.push(error);
                if (error.severity === 'error') {
                    hasErrors = true;
                }
            }
        }
        if (this.upi) {
            this.upi.messages.set(this.errors);
        }
        else {
            this.update();
        }
        return hasErrors;
    }
    unindentMessage(message) {
        let lines = message.split('\n').filter((x) => !x.match(/^\s*$/));
        let minIndent = null;
        for (let line of lines) {
            let match = line.match(/^\s*/);
            let lineIndent = match[0].length;
            if (lineIndent < minIndent || !minIndent) {
                minIndent = lineIndent;
            }
        }
        console.error(minIndent, lines);
        if (minIndent) {
            lines = lines.map((line) => line.slice(minIndent));
        }
        return lines.join('\n');
    }
    parseMessage(raw) {
        let matchLoc = /^(.+):(\d+):(\d+):(?: (\w+):)?\s*(\[[^\]]+\])?/;
        if (raw && raw.trim() !== '') {
            let matched = raw.match(matchLoc);
            if (matched) {
                let msg = raw.split('\n').slice(1).join('\n');
                let [file, line, col, rawTyp, context] = matched.slice(1);
                let typ = rawTyp ? rawTyp.toLowerCase() : 'error';
                if (file === '<interactive>') {
                    file = null;
                    typ = 'repl';
                }
                let msgany = msg;
                return {
                    uri: file ? this.cwd.getFile(this.cwd.relativize(file)).getPath() : null,
                    position: [parseInt(line, 10) - 1, parseInt(col, 10) - 1],
                    message: {
                        text: this.unindentMessage(msgany.trimRight()),
                        highlighter: 'hint.message.haskell',
                    },
                    context: context,
                    severity: typ,
                    _time: Date.now(),
                };
            }
            else {
                return {
                    message: raw,
                    severity: 'repl',
                    _time: Date.now(),
                };
            }
        }
    }
}
exports.IdeHaskellReplBase = IdeHaskellReplBase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRlLWhhc2tlbGwtcmVwbC1iYXNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2lkZS1oYXNrZWxsLXJlcGwtYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsMkNBQTBDO0FBQzFDLDJDQUFpQztBQUVqQyx1REFBZ0Q7QUFDaEQsaUNBQTJCO0FBZ0MzQjtJQVVFLFlBQWEsVUFBVSxFQUFFLEVBQ3ZCLEdBQUcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLEdBQ25GO1FBQ1gsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUE7UUFDZCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksZ0NBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUMxQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsZ0JBQWdCLENBQUE7UUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUE7UUFFaEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLElBQUksRUFBRSxDQUFBO1FBRTdCLFlBQVksQ0FBQyxxREFBWSxNQUFNLENBQU4sSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQTtJQUN2RCxDQUFDO0lBSU0sc0JBQXNCO1FBQzNCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQTtJQUNqRCxDQUFDO0lBRVksVUFBVSxDQUFFLE9BQWU7O1lBQ3RDLElBQUksR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDN0IsSUFBSSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsSUFBSTtnQkFDbkQsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUs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LENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUk7b0JBQ3hFLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFjLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFhLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM3RSxPQUFPLEVBQUU7d0JBQ1AsSUFBSSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUM5QyxXQUFXLEVBQUUsc0JBQXNCO3FCQUNwQztvQkFDRCxPQUFPLEVBQUUsT0FBaUI7b0JBQzFCLFFBQVEsRUFBRSxHQUFHO29CQUNiLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2lCQUNsQixDQUFBO1lBQ0gsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLE1BQU0sQ0FBQztvQkFDTCxPQUFPLEVBQUUsR0FBRztvQkFDWixRQUFRLEVBQUUsTUFBTTtvQkFDaEIsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7aUJBQ2xCLENBQUE7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTFQRCxnREEwUEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBVdGlsIGZyb20gJ2F0b20taGFza2VsbC11dGlscydcbmltcG9ydCB7ZmlsdGVyfSBmcm9tICdmdXp6YWxkcmluJ1xuXG5pbXBvcnQge0NvbW1hbmRIaXN0b3J5fSBmcm9tICcuL2NvbW1hbmQtaGlzdG9yeSdcbmltcG9ydCB7R0hDSX0gZnJvbSAnLi9naGNpJ1xuXG50eXBlIFVQSSA9IGFueVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3U3RhdGUge1xuICB1cmk/OiBzdHJpbmdcbiAgaGlzdG9yeT86IHN0cmluZ1tdXG4gIGF1dG9SZWxvYWRSZXBlYXQ/OiBib29sZWFuXG4gIGNvbnRlbnQ/OiBJQ29udGVudEl0ZW1bXVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb250ZW50SXRlbSB7XG4gIHRleHQ6IHN0cmluZ1xuICBjbHM6IHN0cmluZ1xuICBobD86IGJvb2xlYW5cbn1cblxudHlwZSBTZXZlcml0eSA9ICdlcnJvcicgfCAnd2FybmluZycgfCAncmVwbCcgfCBzdHJpbmdcblxuZXhwb3J0IGludGVyZmFjZSBJRXJyb3JJdGVtIHtcbiAgdXJpPzogc3RyaW5nLFxuICBwb3NpdGlvbj86IFtudW1iZXIsIG51bWJlcl0sXG4gIG1lc3NhZ2U6IHN0cmluZyB8IHsgdGV4dDogc3RyaW5nLCBoaWdobGlnaHRlcjogc3RyaW5nIH0sXG4gIGNvbnRleHQ/OiBzdHJpbmcsXG4gIHNldmVyaXR5OiBTZXZlcml0eSxcbiAgX3RpbWU6IG51bWJlcixcbn1cblxuZGVjbGFyZSBpbnRlcmZhY2UgSU15U3RyaW5nIGV4dGVuZHMgU3RyaW5nIHtcbiAgdHJpbVJpZ2h0ICgpOiBJTXlTdHJpbmdcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElkZUhhc2tlbGxSZXBsQmFzZSB7XG4gIHByb3RlY3RlZCBnaGNpOiBHSENJXG4gIHByb3RlY3RlZCBjd2Q6IEF0b21UeXBlcy5EaXJlY3RvcnlcbiAgcHJvdGVjdGVkIHByb21wdDogc3RyaW5nXG4gIHByb3RlY3RlZCB1cGk6IFVQSVxuICBwcm90ZWN0ZWQgbWVzc2FnZXM6IElDb250ZW50SXRlbVtdXG4gIHByb3RlY3RlZCBlcnJvcnM6IElFcnJvckl0ZW1bXVxuICBwcm90ZWN0ZWQgX2F1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIGhpc3Rvcnk6IENvbW1hbmRIaXN0b3J5XG4gIHByb3RlY3RlZCB1cmk6IHN0cmluZ1xuICBjb25zdHJ1Y3RvciAodXBpUHJvbWlzZSwge1xuICAgIHVyaSwgY29udGVudCwgaGlzdG9yeSwgYXV0b1JlbG9hZFJlcGVhdCA9IGF0b20uY29uZmlnLmdldCgnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JyksXG4gIH06IElWaWV3U3RhdGUpIHtcbiAgICB0aGlzLnVyaSA9IHVyaVxuICAgIHRoaXMuaGlzdG9yeSA9IG5ldyBDb21tYW5kSGlzdG9yeShoaXN0b3J5KVxuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy5lcnJvcnMgPSBbXVxuXG4gICAgdGhpcy5tZXNzYWdlcyA9IGNvbnRlbnQgfHwgW11cblxuICAgIHNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB0aGlzLmluaXRpYWxpemUodXBpUHJvbWlzZSkpXG4gIH1cblxuICBwdWJsaWMgYWJzdHJhY3QgdXBkYXRlICgpXG5cbiAgcHVibGljIHRvZ2dsZUF1dG9SZWxvYWRSZXBlYXQgKCkge1xuICAgIHRoaXMuYXV0b1JlbG9hZFJlcGVhdCA9ICEgdGhpcy5hdXRvUmVsb2FkUmVwZWF0XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuQ29tbWFuZCAoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgbGV0IGlucCA9IGNvbW1hbmQuc3BsaXQoJ1xcbicpXG4gICAgbGV0IHJlcyA9IGF3YWl0IHRoaXMuZ2hjaS53cml0ZUxpbmVzKGlucCwgKHR5cGUsIHRleHQpID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IodHlwZSwgdGV4dClcbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlICdzdGRpbic6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe3RleHQ6IGlucC5qb2luKCdcXG4nKSwgaGw6IHRydWUsIGNsczogJ2lkZS1oYXNrZWxsLXJlcGwtaW5wdXQtdGV4dCd9KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ3N0ZG91dCc6XG4gICAgICAgICAgdGV4dCAmJiB0aGlzLm1lc3NhZ2VzLnB1c2goe3RleHQsIGhsOiB0cnVlLCBjbHM6ICdpZGUtaGFza2VsbC1yZXBsLW91dHB1dC10ZXh0J30pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAncHJvbXB0JzpcbiAgICAgICAgICB0aGlzLnByb21wdCA9IHRleHRbMV1cbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OiBicmVha1xuICAgICAgfVxuICAgICAgdGhpcy51cGRhdGUoKVxuICAgIH0pXG4gICAgdGhpcy5lcnJvcnNGcm9tU3RkZXJyKHJlcy5zdGRlcnIpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGdoY2lSZWxvYWQgKCkge1xuICAgIHJldHVybiB0aGlzLmdoY2kucmVsb2FkKClcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBnaGNpUmVsb2FkUmVwZWF0ICgpIHtcbiAgICBsZXQge3N0ZGVycn0gPSBhd2FpdCB0aGlzLmdoY2kucmVsb2FkKClcbiAgICBpZiAoISB0aGlzLmVycm9yc0Zyb21TdGRlcnIoc3RkZXJyKSkge1xuICAgICAgbGV0IGNvbW1hbmQgPSB0aGlzLmhpc3RvcnkuZ29CYWNrKCcnKVxuICAgICAgcmV0dXJuIHRoaXMucnVuQ29tbWFuZChjb21tYW5kKVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBzZXQgYXV0b1JlbG9hZFJlcGVhdCAoYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhbikge1xuICAgIHRoaXMuX2F1dG9SZWxvYWRSZXBlYXQgPSBhdXRvUmVsb2FkUmVwZWF0XG4gICAgdGhpcy51cGRhdGUoKVxuICB9XG5cbiAgcHVibGljIGdldCBhdXRvUmVsb2FkUmVwZWF0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b1JlbG9hZFJlcGVhdFxuICB9XG5cbiAgcHVibGljIGludGVycnVwdCAoKSB7XG4gICAgdGhpcy5naGNpLmludGVycnVwdCgpXG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGlvbnMgKHByZWZpeCkge1xuICAgIGlmICghcHJlZml4LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuICAgIGxldCB7c3Rkb3V0fSA9IGF3YWl0IHRoaXMuZ2hjaS5zZW5kQ29tcGxldGlvblJlcXVlc3QoKVxuICAgIHN0ZG91dC5zaGlmdCgpXG4gICAgcmV0dXJuIGZpbHRlcihzdGRvdXQsIHByZWZpeCkubWFwKCh0ZXh0KSA9PiAoe3RleHQ6IHRleHQuc2xpY2UoMSwgLTEpfSkpXG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMuZ2hjaSkge1xuICAgICAgdGhpcy5naGNpLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBpbml0aWFsaXplICh1cGlQcm9taXNlOiBQcm9taXNlPFVQST4pIHtcbiAgICB0aGlzLnVwaSA9IGF3YWl0IHVwaVByb21pc2VcbiAgICBpZiAoIXRoaXMudXBpKSB7IHJldHVybiB0aGlzLnJ1blJFUEwobnVsbCkgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxldCBidWlsZGVyID0gYXdhaXQgdGhpcy51cGkucGFyYW1zLmdldCgnaWRlLWhhc2tlbGwtY2FiYWwnLCAnYnVpbGRlcicpXG4gICAgICB0aGlzLnJ1blJFUEwoKGJ1aWxkZXIgfHwge30pLm5hbWUpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRmF0YWxFcnJvcihlcnJvci50b1N0cmluZygpLCB7XG4gICAgICAgICAgZGV0YWlsOiBlcnJvcixcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKFwiQ2FuJ3QgcnVuIFJFUEwgd2l0aG91dCBrbm93aW5nIHdoYXQgYnVpbGRlciB0byB1c2VcIilcbiAgICAgICAgdGhpcy5kZXN0cm95KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgcnVuUkVQTCAoYnVpbGRlcjogc3RyaW5nKSB7XG4gICAgaWYgKCFidWlsZGVyKSB7IGJ1aWxkZXIgPSBhdG9tLmNvbmZpZy5nZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnKSB9XG4gICAgbGV0IHN1YnN0ID0ge1xuICAgICAgJ25peC1idWlsZCc6ICdjYWJhbCcsXG4gICAgICAnbm9uZSc6ICdnaGNpJyxcbiAgICB9XG4gICAgYnVpbGRlciA9IChzdWJzdFtidWlsZGVyXSB8fCBidWlsZGVyKVxuXG4gICAgdGhpcy5jd2QgPSBVdGlsLmdldFJvb3REaXIodGhpcy51cmkpXG5cbiAgICBsZXQgW2NhYmFsRmlsZV0gPVxuICAgICAgdGhpcy5jd2QuZ2V0RW50cmllc1N5bmMoKS5maWx0ZXIoKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiYgZmlsZS5nZXRCYXNlTmFtZSgpLmVuZHNXaXRoKCcuY2FiYWwnKSlcblxuICAgIGxldCBjYWJhbCwgY29tcFxuICAgIGlmIChjYWJhbEZpbGUpIHtcbiAgICAgIGxldCBjYWJhbENvbnRlbnRzID0gY2FiYWxGaWxlLnJlYWRTeW5jKClcbiAgICAgIGNhYmFsID0gVXRpbC5wYXJzZURvdENhYmFsU3luYyhjYWJhbENvbnRlbnRzKVxuICAgICAgW2NvbXBdID0gVXRpbC5nZXRDb21wb25lbnRGcm9tRmlsZVN5bmMoY2FiYWxDb250ZW50cywgdGhpcy5jd2QucmVsYXRpdml6ZSh0aGlzLnVyaSkpXG4gICAgfVxuICAgIGxldCBjb21tYW5kUGF0aCA9IGF0b20uY29uZmlnLmdldChgaWRlLWhhc2tlbGwtcmVwbC4ke2J1aWxkZXJ9UGF0aGApXG5cbiAgICBsZXQgYXJncyA9IHtcbiAgICAgIHN0YWNrOiBbJ2doY2knXSxcbiAgICAgIGNhYmFsOiBbJ3JlcGwnXSxcbiAgICAgIGdoY2k6IFtdLFxuICAgIH1cbiAgICBsZXQgZXh0cmFBcmdzID0ge1xuICAgICAgc3RhY2s6ICh4KSA9PiAnLS1naGNpLW9wdGlvbnM9XCIje3h9XCInLFxuICAgICAgY2FiYWw6ICh4KSA9PiAnLS1naGMtb3B0aW9uPSN7eH0nLFxuICAgICAgZ2hjaTogKHgpID0+IHgsXG4gICAgfVxuXG4gICAgaWYgKCFhcmdzW2J1aWxkZXJdKSB7IHRocm93IG5ldyBFcnJvcignVW5rbm93biBidWlsZGVyICN7YnVpbGRlcn0nKSB9XG4gICAgbGV0IGNvbW1hbmRBcmdzID0gYXJnc1tidWlsZGVyXVxuXG4gICAgY29tbWFuZEFyZ3MucHVzaCguLi4oYXRvbS5jb25maWcuZ2V0KCdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncycpLm1hcChleHRyYUFyZ3NbYnVpbGRlcl0pKSlcblxuICAgIGlmIChjb21wKSB7XG4gICAgICBpZiAoYnVpbGRlciA9PT0gJ3N0YWNrJykge1xuICAgICAgICBpZiAoY29tcC5zdGFydHNXaXRoKCdsaWI6JykpIHtcbiAgICAgICAgICBjb21wID0gJ2xpYidcbiAgICAgICAgfVxuICAgICAgICBjb21wID0gYCR7Y2FiYWwubmFtZX06JHtjb21wfWBcbiAgICAgICAgY29tbWFuZEFyZ3MucHVzaCgnLS1tYWluLWlzJywgY29tcClcbiAgICAgIH0gZWxzZSB7IGNvbW1hbmRBcmdzLnB1c2goY29tcCkgfVxuICAgIH1cblxuICAgIHRoaXMuZ2hjaSA9IG5ldyBHSENJKHtcbiAgICAgIGF0b21QYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuICAgICAgY29tbWFuZDogY29tbWFuZFBhdGgsXG4gICAgICBhcmdzOiBjb21tYW5kQXJncyxcbiAgICAgIGN3ZDogdGhpcy5jd2QuZ2V0UGF0aCgpLFxuICAgICAgb25FeGl0OiBhc3luYyAoY29kZSkgPT4gdGhpcy5kZXN0cm95KCksXG4gICAgfSlcblxuICAgIGF3YWl0IHRoaXMuZ2hjaS53YWl0UmVhZHkoKVxuXG4gICAgdGhpcy5naGNpLmxvYWQodGhpcy51cmksICh0eXBlLCB0ZXh0KSA9PiB7XG4gICAgICBpZiAodHlwZSA9PT0gJ3Byb21wdCcpIHtcbiAgICAgICAgdGhpcy5wcm9tcHQgPSB0ZXh0WzFdXG4gICAgICAgIHRoaXMudXBkYXRlKClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJvdGVjdGVkIGVycm9yc0Zyb21TdGRlcnIgKHN0ZGVycjogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgICB0aGlzLmVycm9ycyA9IHRoaXMuZXJyb3JzLmZpbHRlcigoe190aW1lfSkgPT4gRGF0ZS5ub3coKSAtIF90aW1lIDwgMTAwMDApXG4gICAgbGV0IGhhc0Vycm9ycyA9IGZhbHNlXG4gICAgZm9yIChsZXQgZXJyIG9mIHN0ZGVyci5qb2luKCdcXG4nKS5zcGxpdCgvXFxuKD89XFxTKS8pKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGxldCBlcnJvciA9IHRoaXMucGFyc2VNZXNzYWdlKGVycilcbiAgICAgICAgdGhpcy5lcnJvcnMucHVzaChlcnJvcilcbiAgICAgICAgaWYgKGVycm9yLnNldmVyaXR5ID09PSAnZXJyb3InKSB7XG4gICAgICAgICAgaGFzRXJyb3JzID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnVwaSkge1xuICAgICAgdGhpcy51cGkubWVzc2FnZXMuc2V0KHRoaXMuZXJyb3JzKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZSgpXG4gICAgfVxuICAgIHJldHVybiBoYXNFcnJvcnNcbiAgfVxuXG4gIHByb3RlY3RlZCB1bmluZGVudE1lc3NhZ2UgKG1lc3NhZ2UpOiBzdHJpbmcge1xuICAgIGxldCBsaW5lcyA9IG1lc3NhZ2Uuc3BsaXQoJ1xcbicpLmZpbHRlcigoeCkgPT4gIXgubWF0Y2goL15cXHMqJC8pKVxuICAgIGxldCBtaW5JbmRlbnQgPSBudWxsXG4gICAgZm9yIChsZXQgbGluZSBvZiBsaW5lcykge1xuICAgICAgbGV0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyovKVxuICAgICAgbGV0IGxpbmVJbmRlbnQgPSBtYXRjaFswXS5sZW5ndGhcbiAgICAgIGlmIChsaW5lSW5kZW50IDwgbWluSW5kZW50IHx8ICFtaW5JbmRlbnQpIHsgbWluSW5kZW50ID0gbGluZUluZGVudCB9XG4gICAgfVxuICAgIGNvbnNvbGUuZXJyb3IobWluSW5kZW50LCBsaW5lcylcbiAgICBpZiAobWluSW5kZW50KSB7XG4gICAgICBsaW5lcyA9IGxpbmVzLm1hcCgobGluZSkgPT4gbGluZS5zbGljZShtaW5JbmRlbnQpKVxuICAgIH1cbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJylcbiAgfVxuXG4gIHByb3RlY3RlZCBwYXJzZU1lc3NhZ2UgKHJhdyk6IElFcnJvckl0ZW0ge1xuICAgIGxldCBtYXRjaExvYyA9IC9eKC4rKTooXFxkKyk6KFxcZCspOig/OiAoXFx3Kyk6KT9cXHMqKFxcW1teXFxdXStcXF0pPy9cbiAgICBpZiAocmF3ICYmIHJhdy50cmltKCkgIT09ICcnKSB7XG4gICAgICBsZXQgbWF0Y2hlZCA9IHJhdy5tYXRjaChtYXRjaExvYylcbiAgICAgIGlmIChtYXRjaGVkKSB7XG4gICAgICAgIGxldCBtc2cgPSByYXcuc3BsaXQoJ1xcbicpLnNsaWNlKDEpLmpvaW4oJ1xcbicpXG4gICAgICAgIGxldCBbZmlsZSwgbGluZSwgY29sLCByYXdUeXAsIGNvbnRleHRdOiBTdHJpbmdbXSA9IG1hdGNoZWQuc2xpY2UoMSlcbiAgICAgICAgbGV0IHR5cDogU2V2ZXJpdHkgPSByYXdUeXAgPyByYXdUeXAudG9Mb3dlckNhc2UoKSA6ICdlcnJvcidcbiAgICAgICAgaWYgKGZpbGUgPT09ICc8aW50ZXJhY3RpdmU+Jykge1xuICAgICAgICAgIGZpbGUgPSBudWxsXG4gICAgICAgICAgdHlwID0gJ3JlcGwnXG4gICAgICAgIH1cblxuICAgICAgICAvLyBOT1RFOiB0aGlzIGlzIGRvbmUgYmVjYXVzZSB0eXBlc2NyaXB0IGluc2lzdHMgc3RyaW5ncyBkb250IGhhdmVcbiAgICAgICAgLy8gdHJpbVJpZ2h0KCkgbWV0aG9kXG4gICAgICAgIGxldCBtc2dhbnkgPSBtc2cgYXMgSU15U3RyaW5nXG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1cmk6IGZpbGUgPyB0aGlzLmN3ZC5nZXRGaWxlKHRoaXMuY3dkLnJlbGF0aXZpemUoZmlsZSkpLmdldFBhdGgoKSA6IG51bGwsXG4gICAgICAgICAgcG9zaXRpb246IFtwYXJzZUludChsaW5lIGFzIHN0cmluZywgMTApIC0gMSwgcGFyc2VJbnQoY29sIGFzIHN0cmluZywgMTApIC0gMV0sXG4gICAgICAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgdGV4dDogdGhpcy51bmluZGVudE1lc3NhZ2UobXNnYW55LnRyaW1SaWdodCgpKSxcbiAgICAgICAgICAgIGhpZ2hsaWdodGVyOiAnaGludC5tZXNzYWdlLmhhc2tlbGwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29udGV4dDogY29udGV4dCBhcyBzdHJpbmcsXG4gICAgICAgICAgc2V2ZXJpdHk6IHR5cCxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiByYXcsXG4gICAgICAgICAgc2V2ZXJpdHk6ICdyZXBsJyxcbiAgICAgICAgICBfdGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19