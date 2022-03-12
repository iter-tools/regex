import { parse } from '../pattern';

import { Pattern, PatternLike } from '../types';

type Generate<I> = (pattern: Pattern, iterable: I) => AsyncIterableIterator<Array<string | null>>;

const _: unique symbol = Symbol.for('_');

export class AsyncApi<I> {
  private [_]: { generate: Generate<I> };

  constructor(generate: Generate<I>) {
    this[_] = { generate };
  }

  exec = async (
    pattern: string | PatternLike,
    iterable: I,
  ): Promise<null | Array<string | null>> => {
    const { generate } = this[_];
    const step = await generate(parse(pattern), iterable).next();

    return step.done ? null : step.value;
  };

  test = async (pattern: string | PatternLike, iterable: I): Promise<boolean> => {
    const { exec } = this;
    return (await exec(pattern, iterable)) !== null;
  };

  execGlobal = (
    pattern: string | PatternLike,
    iterable: I,
  ): AsyncIterable<Array<string | null>> => {
    const { generate } = this[_];
    const pattern_ = parse(pattern);
    return {
      [Symbol.asyncIterator]() {
        return generate(pattern_, iterable);
      },
    };
  };
}
