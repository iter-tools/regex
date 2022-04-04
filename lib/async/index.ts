import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import { AsyncApi } from './api';
import { Engine } from '../internal/engine';

export { parse, Pattern } from '../pattern';

export const { exec, test, execGlobal } = new AsyncApi(async function* generate(
  pattern,
  iterable: AsyncIterable<string>,
) {
  const peekr = await asyncPeekerate(iterable);
  const engine = new Engine(pattern);
  let value;
  let done = false;
  let lastChr = null;
  let chr = peekr.done ? null : peekr.value;

  try {
    ({ value, done } = engine.step0(lastChr, chr));
    if (value !== null) yield* value;

    while (!done && chr !== null) {
      engine.step1(chr);

      await peekr.advance();
      lastChr = chr;
      chr = peekr.done ? null : peekr.value;

      ({ value, done } = engine.step0(lastChr, chr));
      if (value !== null) yield* value;
    }
  } finally {
    await peekr.return();
  }
});
