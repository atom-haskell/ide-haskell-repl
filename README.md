# IDE-Haskell REPL

***This package is in beta.***

This package provides a way to interact with ghci (or, more precisely, `cabal repl` or `stack ghci`) from Atom.

![image](https://cloud.githubusercontent.com/assets/7275622/10709920/4fb7ff4a-7a48-11e5-831c-78e3fd0812b5.png)

## Repl backend selection

ide-haskell-repl will try to automatically select the correct repl backend (`stack`/`cabal`/`ghci`) based on current builder chosen in `ide-haskell-cabal`. You can choose `none` builder to use `ghci` in plain projects (a.k.a. projects with no `*.cabal` file).

If `ide-haskell-cabal` is unavailable (e.g. disabled), ide-haskell-repl will fall back to `defaultRepl` specified in settings.

## Using on Windows

On Windows, interrupting ghci will kill it. There is no good solution to this problem at the moment, but there is a "bad" solution.

You need to get `ghci-wrapper.exe` executable from https://github.com/atom-haskell/win-ghci-wrapper/releases (or if you don't trust random binaries you've downloaded from the Internet, you can build it from source -- you only really need ghc for that)

Then you need to specify full path to this executable in `ghciWrapperPath` setting of this package.

For example, if you placed `ghci-wrapper.exe` in `C:\Downloads` directory, you need to put `C:\Downloads\ghci-wrapper.exe` in `ghciWrapperPath` setting.

Finally, restart any open REPL sessions.

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

## License

Copyright © 2015 Atom-Haskell.

See [LICENSE.md][LICENSE] for details.

[LICENSE]: https://github.com/atom-haskell/ide-haskell-repl/blob/master/LICENSE.md

Contributors:

* Nikolay Yakimov
* yaeti
* Yakov Borevich
* soiamsoNG
