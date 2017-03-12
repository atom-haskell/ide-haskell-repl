module.exports = {
  config: {
    defaultRepl: {
      type: 'string',
      "enum": ['stack', 'cabal', 'ghci'],
      "default": 'ghci',
      order: 0
    },
    stackPath: {
      type: 'string',
      "default": 'stack',
      description: 'Path to stack executable',
      order: 10
    },
    cabalPath: {
      type: 'string',
      "default": 'cabal',
      description: 'Path to cabal executable',
      order: 20
    },
    ghciPath: {
      type: 'string',
      "default": 'ghci',
      description: 'Path to ghci executable',
      order: 30
    },
    extraArgs: {
      type: 'array',
      "default": [],
      description: 'Extra arguments passed to ghci. Comma-separated',
      items: {
        type: 'string'
      },
      order: 40
    },
    autoReloadRepeat: {
      type: 'boolean',
      "default": false,
      description: `Automatically reload and repeat last command on file save.
      This is only the default. You can toggle this per-editor using
      ide-haskell-repl:toggle-auto-reload-repeat command`,
      order: 50
    },
    ghciWrapperPath: {
      type: 'string',
      "default": '',
      description: `This is intended to fix the "interrupt closes ghci" problem
      on Windows -- see README for details. This option has no effect on
      other platforms`,
      order: 999
    }
  }
}
