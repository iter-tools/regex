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
  let value;
  let done = false;
  let lastChr = null;
  let chr = peekr.done ? null : peekr.value;

  try {
    ({ value, done } = engine.step0(lastChr, chr));
    if (value !== null) yield* value;

    while (!done && chr !== null) {
      engine.step1(chr);

      peekr.advance();
      lastChr = chr;
      chr = peekr.done ? null : peekr.value;

      ({ value, done } = engine.step0(lastChr, chr));
      if (value !== null) yield* value;
    }
  } finally {
    peekr.return();
  }
});
