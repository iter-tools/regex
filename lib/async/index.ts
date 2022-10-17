import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import asyncWrap from 'iter-tools-es/methods/async-wrap';
import asyncConsume from 'iter-tools-es/methods/async-consume';
import { AsyncApi } from './api';
import { Engine } from '../internal/engine';
import { parse, Pattern } from '../pattern';

export { parse, Pattern };

export const { exec, test, execGlobal } = new AsyncApi(async function* generate(
  pattern,
  iterable: AsyncIterable<string>,
) {
  const peekr = await asyncPeekerate(iterable);
  const engine = new Engine(pattern);

  try {
    engine.feed(null);

    while (!engine.done && !peekr.done) {
      const { starved } = engine;
      if (starved) {
        engine.feed(peekr.value);
      }

      yield* engine.traverse0();

      if (starved) {
        await peekr.advance();
      }

      engine.traverse1();
    }

    if (peekr.done) {
      engine.feed(null);

      yield* engine.traverse0();
    }
  } finally {
    await peekr.return();
  }
});

const warmupPattern1 = parse('.*', 'g');
const warmupPattern2 = parse('(a)|(b)', 'g');

for (let i = 0; i < 4; i++) {
  asyncConsume(execGlobal(warmupPattern1, asyncWrap('ab')));
  asyncConsume(execGlobal(warmupPattern2, asyncWrap('ab')));
  asyncConsume(execGlobal(warmupPattern2, asyncWrap('a')));
  asyncConsume(execGlobal(warmupPattern2, asyncWrap('')));
}
