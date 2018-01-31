export {}
declare module 'atom' {
  type TWatchEditor = (editor: TextEditor, labels: string[]) => Disposable
  interface CommandRegistryTargetMap {
    'atom-text-editor:not(.ide-haskell-repl)': TextEditorElement
    'atom-text-editor.ide-haskell-repl': TextEditorElement
  }
}
