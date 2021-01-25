import { parse } from '../regex';

import { Pattern, PatternLike } from '../types';

export const apiFactory = <I>(
  generate: (pattern: Pattern, iterable: I) => AsyncIterableIterator<Array<string | null>>,
) => {
  const exec = async (pattern: string | PatternLike, iterable: I) => {
    const step = await generate(parse(pattern), iterable).next();

    return step.done ? null : step.value;
  };

  const test = async (pattern: string | PatternLike, iterable: I) => {
    return (await exec(pattern, iterable)) !== null;
  };

  const execGlobal = async (pattern: string | PatternLike, iterable: I) => {
    return generate(parse(pattern), iterable);
  };

  return { exec, test, execGlobal };
};
