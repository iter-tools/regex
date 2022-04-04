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
  let chr: string | null;
  let lastChr: string | null = null!;

  try {
    while (peekr.done && !chunkPeekr.done) {
      chunkPeekr = await chunkPeekr.advance();
      peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
    }

    chr = peekr.done ? null : peekr.value;

    ({ value, done } = engine.step0(lastChr, chr));
    if (value !== null) yield* value;

    try {
      while (!done && !peekr.done) {
        engine.step1(peekr.value);

        peekr = peekr.advance();
        lastChr = chr;
        chr = peekr.done ? null : peekr.value;

        while (peekr.done && !chunkPeekr.done) {
          chunkPeekr = await chunkPeekr.advance();
          peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
        }

        ({ value, done } = engine.step0(lastChr, chr));
        if (value !== null) yield* value;
      }
    } finally {
      peekr.return();
    }
  } finally {
    await chunkPeekr.return();
  }
});
