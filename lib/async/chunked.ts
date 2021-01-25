import { peekerate, asyncPeekerate, Peekerator } from 'iter-tools-es';
import { apiFactory } from './api-factory';
import { Engine } from '../engine';
import { map } from './utils';

export { parse } from '../regex';

export const { exec, test, execGlobal } = apiFactory(async function* generate(
  pattern,
  iterable: AsyncIterable<Iterable<string>>,
) {
  const engine = new Engine(pattern);
  let chunkPeekr = await asyncPeekerate(map(iterable, peekerate));
  let idx = 0;
  let value, done;

  const empty = chunkPeekr.done || chunkPeekr.value.done;

  try {
    ({ value, done } = done
      ? engine.step0(true, true, idx)
      : engine.step0(true, empty, idx, chunkPeekr.value!.value));
    if (value !== null) yield* value;

    if (empty) return;

    let peekr: Peekerator<string> = chunkPeekr.value!;
    while (!done && !peekr.done) {
      try {
        engine.step1(peekr.value);

        peekr = peekr.advance();

        if (peekr.done) {
          chunkPeekr = await chunkPeekr.advance();
          if (chunkPeekr.done) {
            // there may be a final empty chunk
            // and we want a single check for doneness
            // so always simulate a final empty chunk
            peekr = peekerate([]);
          } else {
            peekr = chunkPeekr.value;
          }
        }

        ({ value, done } = engine.step0(false, peekr.done, idx, peekr.value));
        if (value !== null) yield* value;
        idx++;
      } finally {
        peekr.return();
      }
    }
  } finally {
    await chunkPeekr.return();
  }
});
