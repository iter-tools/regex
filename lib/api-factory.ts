import { parse } from './regex';

import { Pattern } from './types';

export const apiFactory = <I>(
  generate: (pattern: Pattern, iterable: I) => IterableIterator<Array<string | null>>,
) => {
  const exec = (pattern: string | Pattern, iterable: I) => {
    const step = generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable).next();

    return step.done ? null : step.value;
  };

  const test = (pattern: string, iterable: I) => {
    return exec(pattern, iterable) !== null;
  };

  const execGlobal = (pattern: string | Pattern, iterable: I) => {
    return generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable);
  };

  return { exec, test, execGlobal };
};
