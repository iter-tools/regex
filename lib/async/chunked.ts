import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import peekerate from 'iter-tools-es/methods/peekerate';
import { AsyncApi } from './api';
import { Engine } from '../internal/engine';
import { map } from './internal/utils';

export { parse, Pattern } from '../pattern';

const emptyPeekr = peekerate([]);

export const { exec, test, execGlobal } = new AsyncApi(async function* generate(
  pattern,
  iterable: AsyncIterable<Iterable<string>>,
) {
  const engine = new Engine(pattern);
  let chunkPeekr = await asyncPeekerate(map(iterable, peekerate));
  let peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
  let value;
  let done = false;

  try {
    engine.feed(null);

    while (peekr.done && !chunkPeekr.done) {
      chunkPeekr = await chunkPeekr.advance();
      peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
    }

    try {
      while (!done && !peekr.done) {
        if (engine.width === 0) {
          engine.feed(peekr.value);

          ({ value, done } = engine.step0());
          yield* value;
        } else {
          engine.step1();

          peekr = peekr.advance();

          while (peekr.done && !chunkPeekr.done) {
            chunkPeekr = await chunkPeekr.advance();
            peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
          }
        }
      }

      engine.feed(null);

      ({ value, done } = engine.step0());
      yield* value;
    } finally {
      peekr.return();
    }
  } finally {
    await chunkPeekr.return();
  }
});
