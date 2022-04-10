import peekerate from 'iter-tools-es/methods/peekerate';
import { Api } from './api';
import { Engine } from './internal/engine';

export { parse, Pattern } from './pattern';

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

      yield* engine.step0();

      engine.step1();
    }

    engine.feed(null);

    yield* engine.step0();
  } finally {
    peekr.return();
  }
});
