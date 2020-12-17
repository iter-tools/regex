# @iter-tools/regex

Work in progress. Next step: replacing my custom parser with the `ret` regex tokenizer so that I can support more features, throw errors on more invalid syntaxes, and also throw errors on syntaxes I do not support.

Will be a streaming regex evaluation engine which accepts iterable inputs -- even potentially infinite ones. Initial work is on sync iterables only, but it should be easy to generalize to async iterables as well.

Thanks to Jason Priestley, without whose [blog post](https://jasonhpriestley.com/regex) I would not have known where to start.
