/* @macrome
 * @generatedby @macrome/generator-typescript
 * @generatedfrom ./index.ts#1640623852812
 * This file is autogenerated. Please do not edit it directly.
 * When editing run `npx macrome watch` then change the file this is generated from.
 */
import asyncPeekerate from 'iter-tools-es/methods/async-peekerate';
import { apiFactory } from './api-factory';
import { Engine } from '../engine';
export { parse } from '../regex';
export const {
  exec,
  test,
  execGlobal
} = apiFactory(async function* generate(pattern, iterable) {
  const peekr = await asyncPeekerate(iterable);
  const engine = new Engine(pattern);
  let value, done;

  try {
    ({
      value,
      done
    } = engine.step0(true, peekr.done, peekr.index, peekr.value));
    if (value !== null) yield* value;

    while (!done && !peekr.done) {
      engine.step1(peekr.value);
      await peekr.advance();
      ({
        value,
        done
      } = engine.step0(false, peekr.done, peekr.index, peekr.value));
      if (value !== null) yield* value;
    }
  } finally {
    await peekr.return();
  }
});