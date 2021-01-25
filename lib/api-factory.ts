import { parse } from './regex';

import { Pattern, PatternLike } from './types';

export const apiFactory = <I>(
  generate: (pattern: Pattern, iterable: I) => IterableIterator<Array<string | null>>,
) => {
  const exec = (pattern: string | PatternLike, iterable: I) => {
    const step = generate(parse(pattern), iterable).next();

    return step.done ? null : step.value;
  };

  const test = (pattern: string | PatternLike, iterable: I) => {
    return exec(pattern, iterable) !== null;
  };

  const execGlobal = (pattern: string | PatternLike, iterable: I) => {
    return generate(parse(pattern), iterable);
  };

  return { exec, test, execGlobal };
};
