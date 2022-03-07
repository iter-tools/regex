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
  let value, done;

  try {
    ({ value, done } = engine.step0(true, peekr.done, peekr.index, peekr.value));
    if (value !== null) yield* value;

    while (!done && !peekr.done) {
      engine.step1(peekr.value);

      peekr.advance();

      ({ value, done } = engine.step0(false, peekr.done, peekr.index, peekr.value));
      if (value !== null) yield* value;
    }
  } finally {
    peekr.return();
  }
});
