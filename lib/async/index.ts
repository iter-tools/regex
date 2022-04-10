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
    engine.feed(null);

    while (!engine.done && !peekr.done) {
      if (engine.starved) {
        engine.feed(peekr.value);
        await peekr.advance();
      }

      yield* engine.step0();

      engine.step1();
    }

    engine.feed(null);

    yield* engine.step0();
  } finally {
    await peekr.return();
  }
});
