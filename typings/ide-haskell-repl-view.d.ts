export default class IdeHaskellReplView {
    constructor({uri, content, history, upiPromise, autoReloadRepeat}: {
        uri: any;
        content: any;
        history: any;
        upiPromise: any;
        autoReloadRepeat?: any;
    });
    render(): any;
    renderErrDiv(): any;
    renderPrompt(): any;
    renderOutput(): any;
    update(): any;
    initialize(): void;
    doRunRepl(): Promise<any>;
    runREPL(builder: any): void;
    execCommand(): void;
    copyText(command: any): void;
    runCommand(command: any, time?: number): void;
    historyBack(): void;
    historyForward(): void;
    ghciReload(): void;
    ghciReloadRepeat(): void;
    toggleAutoReloadRepeat(): void;
    setAutoReloadRepeat(autoReloadRepeat: any): void;
    getAutoReloadRepeat(): any;
    interrupt(): void;
    setPrompt(prompt: any): void;
    getCompletions(prefix: any): any;
    setError(err: any): void;
    splitErrBuffer(errBuffer: any): any;
    unindentMessage(message: any): any;
    parseMessage(raw: any): {
        uri: any;
        position: number[];
        message: any;
        severity: string;
    } | {
        message: any;
        severity: string;
    };
    log(text: any): void;
    logInput(text: any): void;
    logMessage(text: any): void;
    getURI(): string;
    getTitle(): string;
    onDidDestroy(callback: any): any;
    destroy(): Promise<void>;
    serialize(): {
        deserializer: string;
        uri: any;
        upi: boolean;
        content: any;
        history: any;
        autoReloadRepeat: any;
    };
}
