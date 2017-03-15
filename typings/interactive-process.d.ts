export declare class InteractiveProcess {
    constructor(cmd: any, args?: any[], opts?: {});
    request(gen: any): void;
    sendLines(lines: any, type: any): void;
    getNext(): void;
    handleDone(done: any): void;
    destroy(): void;
}
