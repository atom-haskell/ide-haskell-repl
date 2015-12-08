# IDE-Haskell REPL

***This is a very early prototype.***

This package provides a way to interact with ghci (or, more precisely, `cabal repl`) from Atom.

![image](https://cloud.githubusercontent.com/assets/7275622/10709920/4fb7ff4a-7a48-11e5-831c-78e3fd0812b5.png)

## Repl-specific commands

To send command, or move through history, you can use the following commands when focused on repl command editor:

* `ide-haskell-repl:exec-command`
* `ide-haskell-repl:history-back`
* `ide-haskell-repl:history-forward`
* `ide-haskell-repl:ghci-reload`

Note that this commands are bound specifically to repl editor, which has CSS selector of `atom-text-editor.ide-haskell-repl`.

You can rebind those in your keymap, e.g.

```
"atom-text-editor.ide-haskell-repl":
  'ctrl-enter': 'ide-haskell-repl:exec-command'
  'ctrl-up': 'ide-haskell-repl:history-back'
  'ctrl-down': 'ide-haskell-repl:history-forward'
```

Just don't forget to disable default bindings in ide-haskell-repl settings, if you don't want them.
