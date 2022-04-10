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
      if (engine.width === 0) {
        engine.feed(peekr.value);

        yield* engine.step0();
      } else {
        engine.step1();

        peekr.advance();
      }
    }

    engine.feed(null);

    yield* engine.step0();
  } finally {
    peekr.return();
  }
});
