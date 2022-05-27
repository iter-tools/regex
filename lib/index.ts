import peekerate from 'iter-tools-es/methods/peekerate';
import consume from 'iter-tools-es/methods/consume';
import { Api } from './api';
import { Engine } from './internal/engine';
import { parse, Pattern } from './pattern';

export { parse, Pattern };

export const { exec, test, execGlobal } = new Api(function* generate(
  pattern,
  iterable: Iterable<string>,
) {
  const peekr = peekerate(iterable);
  const engine = new Engine(pattern);

  try {
    engine.feed(null);

    while (!engine.done && !peekr.done) {
      if (engine.starved) {
        engine.feed(peekr.value);
        peekr.advance();
      }

      yield* engine.traverse0();

      engine.traverse1();
    }

    engine.feed(null);

    yield* engine.traverse0();
  } finally {
    peekr.return();
  }
});

const warmupPattern1 = parse('.*', 'g');
const warmupPattern2 = parse('(a)|(b)', 'g');

// Help avoid deopts when the setup and body of generate and step0 are hot
// but code to do with pattern or input termination is not
for (let i = 0; i < 4; i++) {
  consume(execGlobal(warmupPattern1, 'ab'));
  consume(execGlobal(warmupPattern2, 'ab'));
  consume(execGlobal(warmupPattern2, 'a'));
  consume(execGlobal(warmupPattern2, ''));
}
