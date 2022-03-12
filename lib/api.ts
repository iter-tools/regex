import type { PatternLike } from './types';

import { parse, Pattern } from './pattern';

type Generate<I> = (pattern: Pattern, iterable: I) => IterableIterator<Array<string | null>>;

const _: unique symbol = Symbol.for('_');

export class Api<I> {
  private [_]: { generate: Generate<I> };

  constructor(generate: Generate<I>) {
    this[_] = { generate };
  }

  exec = (pattern: string | PatternLike, iterable: I): null | Array<string | null> => {
    const { generate } = this[_];
    const step = generate(parse(pattern), iterable).next();

    return step.done ? null : step.value;
  };

  test = (pattern: string | PatternLike, iterable: I): boolean => {
    const { exec } = this;
    return exec(pattern, iterable) !== null;
  };

  execGlobal = (pattern: string | PatternLike, iterable: I): Iterable<Array<string | null>> => {
    const { generate } = this[_];
    const pattern_ = parse(pattern);
    return {
      [Symbol.iterator]() {
        return generate(pattern_, iterable);
      },
    };
  };
}
