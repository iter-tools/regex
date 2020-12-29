# @iter-tools/regex

A non-backtracking regex engine for use with streaming inputs implemented using Nondeterministic Finite Automata (NFA). Full support for captures.

Work in progress. Next step: replacing my custom parser with the `ret` regex tokenizer so that I can support more features, throw errors on more invalid syntaxes, and also throw errors on syntaxes I do not support.

## Usage

```js
import { test, exec, execGlobal } from '@iter-tools/regex';

test('foo|bar', 'snafoo'); // true
exec('ab(.*)', 'abcd'); // ['abcd', 'cd']
execGlobal('a.', 'abacad'); // Iterable[[ab], [ac], [ad]]
```

## Credits

Thanks to Jason Priestley, without whose [blog post](https://jasonhpriestley.com/regex) I would not have known where to start.
