import type { Peekerator } from 'iter-tools-es';
import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import peekerate from 'iter-tools-es/methods/peekerate';
import { AsyncApi } from './api';
import { Engine } from '../internal/engine';
import { map } from './internal/utils';

export { parse, Pattern } from '../pattern';

export const { exec, test, execGlobal } = new AsyncApi(async function* generate(
  pattern,
  iterable: AsyncIterable<Iterable<string>>,
) {
  const engine = new Engine(pattern);
  let chunkPeekr = await asyncPeekerate(map(iterable, peekerate));
  let idx = 0;
  let value, done;

  const empty = chunkPeekr.done || chunkPeekr.value.done;

  try {
    ({ value, done } = engine.step0(true, empty, idx, chunkPeekr.value && chunkPeekr.value.value));
    if (value !== null) yield* value;

    if (empty) return;

    let peekr: Peekerator<string> = chunkPeekr.value!;
    try {
      while (!done && !peekr.done) {
        engine.step1(peekr.value);

        peekr = peekr.advance();

        if (peekr.done) {
          chunkPeekr = await chunkPeekr.advance();
          if (chunkPeekr.done) {
            // there may be a final empty chunk
            // and we want a single check for doneness
            // so always simulate a final empty chunk
            peekr = peekerate([]);
          } else {
            peekr = chunkPeekr.value;
          }
        }

        ({ value, done } = engine.step0(false, peekr.done, idx, peekr.value));
        if (value !== null) yield* value;
        idx++;
      }
    } finally {
      peekr.return();
    }
  } finally {
    await chunkPeekr.return();
  }
});
