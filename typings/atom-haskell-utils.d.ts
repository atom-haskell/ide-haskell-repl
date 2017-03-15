/// <reference path="../typings/atom.d.ts" />

declare module "atom-haskell-utils" {
    export function isDirectory(dir: AtomTypes.Directory | string): boolean;
    export function getRootDirFallback(file: AtomTypes.File | AtomTypes.Directory): AtomTypes.Directory;
    export function getRootDir(bufferOrFileOrString: AtomTypes.TextBuffer | AtomTypes.File | string) : AtomTypes.Directory;
    export function parseDotCabal(...any: any[]) : any
    export function getComponentFromFile(...any: any[]) : any
    export function parseDotCabalSync(...any: any[]) : any
    export function getComponentFromFileSync(...any: any[]) : any
    export function unlit(...any: any[]) : any
    export function unlitSync(...any: any[]) : any
    export function parseHsModuleImports(...any: any[]) : any
    export function parseHsModuleImportsSync(...any: any[]) : any
    export function hsEscapeString(...any: any[]) : any
}
