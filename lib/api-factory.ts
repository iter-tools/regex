import { parse } from './regex';

import { Pattern, PatternLike } from './types';

interface Api<I> {
  exec(pattern: string | PatternLike, iterable: I): null | Array<string | null>;
  test(pattern: string | PatternLike, iterable: I): boolean;
  execGlobal(pattern: string | PatternLike, iterable: I): Iterable<Array<string | null>>;
}

type Generate<I> = (pattern: Pattern, iterable: I) => IterableIterator<Array<string | null>>;

const { hasOwnProperty } = Object.prototype;

const bindAll = <T>(obj: T): T => {
  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      const fn = obj[key];
      if (typeof fn === 'function') {
        obj[key] = fn.bind(obj);
      }
    }
  }
  return obj;
};

export const apiFactory: <I>(generate: Generate<I>) => Api<I> = (generate) => {
  return bindAll({
    exec(pattern, iterable) {
      const step = generate(parse(pattern), iterable).next();

      return step.done ? null : step.value;
    },
    test(pattern, iterable) {
      return this.exec(pattern, iterable) !== null;
    },
    execGlobal(pattern, iterable) {
      return generate(parse(pattern), iterable);
    },
  });
};
