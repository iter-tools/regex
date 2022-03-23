import { parse } from '../pattern';

import { Pattern, PatternLike } from '../types';

type Generate<I> = (
  pattern: Pattern,
  iterable: I,
) => AsyncIterableIterator<Array<string | undefined>>;

const _: unique symbol = Symbol.for('_');

export class AsyncApi<I> {
  private [_]: { generate: Generate<I> };

  constructor(generate: Generate<I>) {
    this[_] = { generate };
  }

  exec = async (pattern: string | PatternLike, iterable: I): Promise<Array<string | undefined>> => {
    const { generate } = this[_];
    const step = await generate(parse(pattern), iterable).next();

    return step.done ? [] : step.value;
  };

  test = async (pattern: string | PatternLike, iterable: I): Promise<boolean> => {
    const { exec } = this;
    return (await exec(pattern, iterable)).length > 0;
  };

  execGlobal = (
    pattern: string | PatternLike,
    iterable: I,
  ): AsyncIterable<Array<string | undefined>> => {
    const { generate } = this[_];
    const pattern_ = parse(pattern);
    return {
      [Symbol.asyncIterator]() {
        return generate(pattern_, iterable);
      },
    };
  };
}
