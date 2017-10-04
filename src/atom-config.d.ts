declare namespace AtomTypes {
  interface ConfigInterface {
    'ide-haskell-repl.defaultRepl': 'stack' | 'cabal' | 'ghci'
    'ide-haskell-repl.stackPath': string
    'ide-haskell-repl.cabalPath': string
    'ide-haskell-repl.ghciPath': string
    'ide-haskell-repl.extraArgs': string[]
    'ide-haskell-repl.autoReloadRepeat': boolean
    'ide-haskell-repl.maxMessages': number
    'ide-haskell-repl.showTypes': boolean
    'ide-haskell-repl.checkOnSave': boolean
    'ide-haskell-repl.ghciWrapperPath': string
  }
}
