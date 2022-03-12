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
  let value, done;

  try {
    ({ value, done } = engine.step0(true, peekr.done, peekr.index, peekr.value));
    if (value !== null) yield* value;

    while (!done && !peekr.done) {
      engine.step1(peekr.value);

      await peekr.advance();

      ({ value, done } = engine.step0(false, peekr.done, peekr.index, peekr.value));
      if (value !== null) yield* value;
    }
  } finally {
    await peekr.return();
  }
});
