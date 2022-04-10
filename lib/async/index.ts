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

  try {
    let value;
    let done = false;

    engine.feed(null);

    while (!done && !peekr.done) {
      if (engine.width === 0) {
        engine.feed(peekr.value);

        ({ value, done } = engine.step0());
        yield* value;
      } else {
        engine.step1();

        await peekr.advance();
      }
    }

    engine.feed(null);

    ({ value, done } = engine.step0());
    yield* value;
  } finally {
    await peekr.return();
  }
});
