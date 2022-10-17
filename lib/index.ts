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
  const engine = new Engine(pattern);
  let peekr = peekerate(iterable);

  try {
    engine.feed(null);

    while (!peekr.done) {
      engine.feed(peekr.value);

      yield* engine.traverse0();

      engine.traverse1();

      if (engine.done) {
        break;
      } else {
        peekr = peekr.advance();
      }
    }

    if (peekr.done) {
      engine.feed(null);

      yield* engine.traverse0();
    }
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
