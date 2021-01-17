import { peekerate } from 'iter-tools-es';
import { apiFactory } from './api-factory';
import { Engine } from './engine';

export { parse } from './regex';

export const { exec, test, execGlobal } = apiFactory(function* generate(
  pattern,
  iterable: Iterable<string>,
) {
  const peekr = peekerate(iterable);
  const engine = new Engine(pattern);
  let value, done;

  try {
    ({ value, done } = engine.step0(true, peekr.done, peekr.index));
    if (value !== null) yield* value;

    while (!done && !peekr.done) {
      engine.step1(peekr.value);

      peekr.advance();

      ({ value, done } = engine.step0(false, peekr.done, peekr.index));
      if (value !== null) yield* value;
    }
  } finally {
    peekr.return();
  }
});
