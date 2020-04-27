## 0.10.0

-   Simplify error parsing somewhat
-   Fix duplicate error filtering
-   Colorize error severity in error div
-   Option to put errors in main repl output

## 0.9.7

-   Add run code button

## 0.9.5

-   Make error div selectable\/copyable
-   Update repl view when changing editor font size\/family

## 0.9.4

-   Enable setup-ghci-wrapper command on windows

## 0.9.3

-   Fix and clean-up wrapper set-up code

## 0.9.2

-   Add command to setup ghci-wrapper

## 0.9.1

-   Fix interrupt when using ghci-wrapper
-   Relax autoscroll condition

## 0.9.0

-   Reorder initialization to fix prompt bug
-   Bump dependencies & cabal-install 3.0 compatibility

## 0.8.7

-   Fix type collection on initial load

## 0.8.6

-   Optimize type collection a little bit

## 0.8.5

-   Don't relativize absolute paths in messages

## 0.8.4

-   Minor fixes, reload GHCI on no type (fixes no type tooltips until saved)

## 0.8.3

-   Update dependencies
-   Properly dispose of crashed background processes
-   Better spawn errors and crash handling

## 0.8.2

-   Fixed opening repl outside of a source file
-   Handle tabs in cabalfile more gracefully

    Note: tabs are forbidden in Cabalfiles, most of the ecosystem can't
    handle those. `stack` replaces tabs with spaces, but spews warnings.
    Other tools just silently fail. Please don't use tabs in cabalfiles.

-   Fix button state initialization

    Toggle buttons are now displayed correctly across Atom restarts

-   Bump dependencies

## 0.8.1

-   More careful asyncIterator definition
-   Avoid extraneous reload
-   Use atom-ts-spec-runner

## 0.8.0

-   Use reference-counting to track background REPL processes

    This avoids leaking REPL processes. This wasn't a big issue, since
    only one process per Cabal component is spawned, but no point in
    wasting resources.

-   More robust tracking of load/reload in REPL

    Manual loading/reloading via `:reload`, `:load` and `:edit` is now
    tracked.

-   Set editor to `atom --wait`

    This is mostly useful with newer Atom versions, where `--wait`
    actually waits before associated editor is closed

-   Better compilation error tracking and reporting

    Fixes \#65

-   Fixed show type ("absolutize" relative paths)

    GHCi 8.2.2 is somewhat inconsistent with how it gives file paths for
    `:all-types`. This problem is fixed.

-   Better reporting for startup errors
-   Support for cabal new-repl

## 0.7.16

-   Add busy indicator
-   Fix stdin input not showing up (\#62)
-   Fix spec runner
-   Pin typescript version
-   Bump dependencies

## 0.7.15

-   Fix error clear/show races, fix reload command

## 0.7.14

-   Do not allow input before REPL is initialized
-   Clear errors on reload

## 0.7.13

-   Don't send raw stdin if ghci is busy with autocompletion request

## 0.7.12

-   Display stdin input straight away; tweak style a bit

## 0.7.11

-   Prettier sources
-   Fix spec, Travis
-   Simplify focus retention, allow selecting output
-   Don't try to watch editor if repl view is destroyed
-   Remove repl editor registration in atom.textEditors

## 0.7.10

-   Atom 1.23 support (repl autocompletion broken)
-   Dispose of repl's TextEditor registration

## 0.7.9

-   Try hard to maintain editor focus
-   Update licensing information in README
-   Bump typings

## 0.7.8

-   Add tslib to dependencies

## 0.7.7

-   Bump Atom version
-   Try to focus text editor on repl creation; restore text editor focus
    on restart
-   New typings; update deps; bump es target
-   Added david-dm badge

## 0.7.6

-   Bump atom-haskell-utils (getComponentsFromFile bug)

## 0.7.5

-   Don't use --main-is, broken on new stack versions
-   Updates to lints, typings, minor fixes

## 0.7.4

-   Unset continuation prompt (GHC 8.2 compatibility)
-   Fix error rendering in absence of ide-haskell

## 0.7.3

-   Better reporting of startup errors

## 0.7.2

-   Fix EOL on Windows

## 0.7.1

-   Fallback on default repl in case of UPI-reladted errors
-   Enforce code style
-   Update typings

## 0.7.0

-   Rewrite in TypeScript
-   Use etch UI
-   Migrate to UPI 0.3
-   Updates for Atom 1.19
-   Bump min. Atom version to 1.19

## 0.6.0

-   Collect error messages
-   Add reload-repeat button
-   Refactor adding buttons
-   Button tooltips
-   Toggle autoReloadRepeat button
-   Serialize autoReloadRepeat
-   Add some repl-context commands
-   Some error handling for runCommand
-   Hide load/reload messages
-   Minimal indication that auto-reload-repeat is active
-   Common code, DRY
-   Factor autoReloadRepeat into replView
-   Add reload to editor context
-   Report pre-start errors

## 0.5.2

-   Use atom-highlight for highlighting

## 0.5.1

-   Merge remote-tracking branch 'origin/atom-1.13'
-   s/target/currentTarget/
-   Bump engine version
-   Atom 1.13 updates

## 0.5.0

-   GHCi-powered autocompletion in REPL input (by @yaeti)

## 0.4.9

-   Default output fonts

## 0.4.8

-   Fix selection commands

## 0.4.7

-   Merge pull request \#43 from soiamsoNG/patch-1
-   Quote the path (soiamsoNG)

## 0.4.6

-   Fix \#40 (error panel shrinking)

## 0.4.5

-   Fix some formatting issues on Windows
-   \[README\] reword "using on windows" a bit

## 0.4.4

-   Band-aid some Windows-specific issues

## 0.4.3

-   Revert "First attempt at fixing win32 interrupt"

## 0.4.2

-   First attempt at fixing win32 interrupt
-   Fix LICENSE date
-   Fix license

## 0.4.1

-   Only store history back buffer

## 0.4.0

-   Resolve UPI promise on timeout
-   Trim errDiv output
-   Initial support for (de)serialization
-   Removed old code
-   Better output handling, minor bugfixes

## 0.3.1

-   Filter out ANSI escape sequences from REPL output

## 0.3.0

-   Auto reload-repeat
-   Add reload-repeat command, some focus/scope fixes on commands
-   Don't save `:reload` in command history

## 0.2.1

-   Remove debug string

## 0.2.0

-   Add commands to copy/run selected text from current editor

## 0.1.11

-   Add interrupt command

## 0.1.10

-   Allow n as newline separator on Win32 in addition to rn

## 0.1.9

-   Switch to child\_process

## 0.1.8

-   Really fix \#33

## 0.1.7

-   Fix \#33
-   Revert "Tentative fix for \#33"

## 0.1.6

-   Tentative fix for \#33

## 0.1.5

-   Fix \#32

## 0.1.4

-   Make repl input soft-wrapped

## 0.1.3

-   Fix some issues, use UPI 0.2.0

## 0.1.2

-   Close repl if no builder selected

## 0.1.1

-   Fix \#28
-   Hack to suppress ac-p, ahu bump
-   Readme update
-   Update package status in README

## 0.1.0

-   Auto-switch based on ide-haskell-cabal builder

## 0.0.23

-   Fix \#23

## 0.0.22

-   AHS bump
-   Atom-haskell-utils bump
-   Set settings order

## 0.0.21

-   Set ghc process encoding
-   Use n instead of ␊

## 0.0.20

-   Ability to supply stdin
-   Interrupt button

## 0.0.19

-   Quick fix for \#18

## 0.0.18

-   Special handling of components for stack
-   atom-haskell-utils version bump

## 0.0.17

-   BUGFIX: atom-haskell-utils bump

## 0.0.16

-   Fix isDirectory bug

## 0.0.15

-   Use synchronous call to getComponentFromFile(Sync)
-   Remove unneeded import

## 0.0.14

-   Fix \#2 (cabal component selection)

## 0.0.13

-   Fix \#1

## 0.0.12

-   Fix \#14

## 0.0.11

-   Log errors on exit, log stderr in console

## 0.0.10

-   Merge pull request \#13 from jjay/master
-   Focus repl input on repl focus

## 0.0.9

-   Work around Atom not displaying keybindings

## 0.0.8

-   Use keymaps for default bindings, OSX bindings

## 0.0.7

-   Use ide-haskell's UPI for error/warning output

## 0.0.6

-   Get Atom path from process.execPath

## 0.0.5

-   Rebindable commands, reload command

## 0.0.4

-   Handle some errors

## 0.0.3

-   Remove redundant @\[0\] and better errDiv styling

## 0.0.2

-   Remove bogus serialization
-   Activate on Haskell sources only

## 0.0.1

-   Initial prototype release
