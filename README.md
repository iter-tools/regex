# @iter-tools/regex

A non-backtracking regex engine for use with streaming inputs implemented using Nondeterministic Finite Automata (NFA). Full support for captures.

Work in progress. See issues for missing functionality.

## Usage

```js
import { test, exec, execGlobal } from '@iter-tools/regex';

test('foo|bar', 'snafoo'); // true
exec('ab(.*)', 'abcd'); // ['abcd', 'cd']
execGlobal('a.', 'abacad'); // Iterable[[ab], [ac], [ad]]
```

## Credits

Thanks to Jason Priestley, without whose [blog post](https://jasonhpriestley.com/regex) I would not have known where to start.
