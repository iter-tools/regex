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

        peekr.advance();
      }
    }

    engine.feed(null);

    ({ value, done } = engine.step0());
    yield* value;
  } finally {
    peekr.return();
  }
});
