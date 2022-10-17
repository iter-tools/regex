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
  const engine = new Engine(pattern);
  let peekr = await asyncPeekerate(iterable);

  try {
    engine.feed(null);

    while (!peekr.done) {
      engine.feed(peekr.value);

      yield* engine.traverse0();

      engine.traverse1();

      if (engine.done) {
        break;
      } else {
        peekr = await peekr.advance();
      }
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
