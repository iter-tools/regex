import asyncWrap from 'iter-tools-es/methods/async-wrap';
import asyncConsume from 'iter-tools-es/methods/async-consume';
import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import peekerate from 'iter-tools-es/methods/peekerate';
import { AsyncApi } from './api';
import { Engine } from '../internal/engine';
import { map } from './internal/utils';
import { parse, Pattern } from '../pattern';

export { parse, Pattern };

const emptyPeekr = peekerate([]);

export const { exec, test, execGlobal } = new AsyncApi(async function* generate(
  pattern,
  iterable: AsyncIterable<Iterable<string>>,
) {
  const engine = new Engine(pattern);
  let chunkPeekr = await asyncPeekerate(map(iterable, peekerate));
  let peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;

  try {
    while (peekr.done && !chunkPeekr.done) {
      chunkPeekr = await chunkPeekr.advance();
      peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
    }

    engine.feed(null);

    try {
      while (!engine.done && !peekr.done) {
        engine.feed(peekr.value);

        yield* engine.traverse0();

        engine.traverse1();

        if (engine.done) {
          break;
        } else {
          peekr = peekr.advance();

          while (peekr.done && !chunkPeekr.done) {
            chunkPeekr = await chunkPeekr.advance();
            peekr = chunkPeekr.done ? emptyPeekr : chunkPeekr.value;
          }
        }
      }

      if (peekr.done) {
        engine.feed(null);

        yield* engine.traverse0();
      }
    } finally {
      peekr.return();
    }
  } finally {
    await chunkPeekr.return();
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
