# @iter-tools/regex

`@iter-tools/regex` is a fully-featured non-backtracking regex engine, scripted in javascript. The engine's implementation is non-backtracking, which makes it ideal for matching against streaming inputs of any kind. It is expected to be used most commonly in the building of streaming parsers, especially in conjunction with `@iter-tools/parserate` (coming soon!).

Not everyone needs a streaming regex engine, but sometimes its abilities are extremely useful. It is able to work on live input streams for example, which are of potentially infinite size. This is because its non-backtracking state machine (it's an NFA) means it need only keep one character (ok, two characters) from a stream in memory at a time.

## Performance

The non-backtracking design also means the engine is not vulnerable to the phenomenon known as catastrophic backtracking, which can make some not-uncommon naively written patterns have essentially infinite time cost to evaluate. This makes the engine more suitable for use with user-supplied patterns, especially when combined with tools like glob syntaxes which can offer users some of the power of regex (and compile to regexe) but without the steep learning curve of regex syntax.

While the engine is not vulnerable to catastrophic backtracking, it can still be attacked or misued. Bad patterns will tend to cause the engine's match state to balloon in size, consuming lots of memory.

If you do not need a streaming regex engine, it is still possible that it could offer you performance benefits. This implementation does not compete with the native implementation for raw speed, but bandwidth is a major constraint and it is possible to do some useful work without having all the data loaded then the concurrency it provides can easily make it faster than the alternate approach, even for files of a modest size. If performance is a serious concern, only testing can show what is fastest for an arbitrary combination of input and pattern.

## API

[test](#test)(pattern, input)  
[exec](#exec)(pattern, input)  
[execGlobal](#execglobal)(pattern, input)

**Note that this API is exported as three separate submodules, each with a slightly different purpose!**

The modules are:

- `/` (`@iter-tools/regex`) is the base module, for use when `input` is a sync iterator.
- `/async` (`@iter-tools/regex/async`) is for use with async iterables of characters, such as `iter-tools` might produce.
- `/async/chunked` (`@iter-tools/regex/async/chunked`) is meant to optimize performance when use with streams (iterables of strings, that is) such as those returned by `fs.createReadStream(path, 'utf-8')`.

### test

```js
import { test } from '@iter-tools/regex';
import { test as testAsync } from '@iter-tools/regex/async';
import { test as testChunked } from '@iter-tools/regex/async/chunked';

const didMatch = test(pattern, input);
const didMatch = await testAsync(pattern, input);
const didMatch = await testChunked(pattern, input);
```

`didMatch` will be `true` if `pattern` matches at some location in `input`.

### exec

```js
import { exec } from '@iter-tools/regex';
import { exec as execAsync } from '@iter-tools/regex/async';
import { exec as execChunked } from '@iter-tools/regex/async/chunked';

const captures = exec(pattern, input);
const captures = await execAsync(pattern, input);
const captures = await execChunked(pattern, input);
// 1-indexed by lexical order of `(` ($2 is b)
const [match, $1, $2, $3] = exec(/(a(b))(c)/, input);
```

`captures` will be the array of `[match, ...captures]` from the first location where `pattern` matches in `input`. This method differs from the spec in that it returns `[]` (**NOT** `null`) when `pattern` is not found in `input`. This is so that it may be used more nicely with destructuring. If you need to check if the match was present, you can still do it nicely with destructuring syntax:

```js
const [match = null, $1] = exec(/.*(a)/, input);

if (match !== null) console.log(`match: '${match}'`);
if ($1 !== undefined) console.log(`$1: '${$1}'`);
```

### execGlobal

<!--prettier-ignore-->
```js
import { execGlobal } from '@iter-tools/regex';
import { execGlobal as execGlobalAsync } from '@iter-tools/regex/async';
import { execGlobal as execGlobalChunked } from '@iter-tools/regex/async/chunked';

const [...matches] = execGlobal(pattern, input);
for await (const match of execGlobal(pattern, input)) { }
for await (const match of execGlobalChunked(pattern, input)) { }
```

`matches` is an iterable of match arrays (`Iterable[[match, ...captures], ...matches]`). If `pattern` is not found in `input` the iterable of matches will be empty. `execGlobal` interacts with the `global` (`/g`) flag. **If the `/g` flag is not present the `matches` iterable will never contain more than one match.**

## Patterns and flags

Some syntaxes are unsupported. Unsupported syntaxes are still parsed as long as they are in the well-supported [regexpp](https://github.com/mysticatea/regexpp) parser, so that you will not be allowed to write expressions which would not be compatible with other engines.

- Patterns do not support lookbehind (`(?<=abc)` and `(?<!abc)`).

- Patterns do not support lookahead (yet) (`(?=abc)` and `(?!abc)`). See [#11](https://github.com/iter-tools/regex/issues/11).

- Patterns do not support named capture groups (`(?<name>)`) (yet).

- The unicode flag (`/u`) is not supported yet. Supporting it is a top priority. See [#33](https://github.com/iter-tools/regex/issues/33).

- The sticky flag (`/y`) is partially supported. It restricts matching to only attempt to match `pattern` at the start of `input` or at the end of a global match (when `/g` is also present). Not the same as putting a `^` in the pattern, which may be affected by the multiline flag (`/m`).

## Credits

Thanks Jason Priestley! Without your [blog post](https://jasonhpriestley.com/regex) I would not have known where to start. Also thanks to my friends and family, who have heard me talk about this more than any of them could possibly want to.
