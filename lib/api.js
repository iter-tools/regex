/* @macrome
 * @generatedby @macrome/generator-typescript
 * @generatedfrom ./api.ts#1646671173071
 * This file is autogenerated. Please do not edit it directly.
 * When editing run `npx macrome watch` then change the file this is generated from.
 */
import { parse } from './pattern';

const _ = Symbol.for('_');

export class Api {
  constructor(generate) {
    this[_] = { generate };
  }

  exec = (pattern, iterable) => {
    const { generate } = this[_];
    const step = generate(parse(pattern), iterable).next();

    return step.done ? null : step.value;
  };

  test = (pattern, iterable) => {
    const { exec } = this;
    return exec(pattern, iterable) !== null;
  };

  execGlobal = (pattern, iterable) => {
    const { generate } = this[_];
    const pattern_ = parse(pattern);
    return {
      [Symbol.iterator]() {
        return generate(pattern_, iterable);
      },
    };
  };
}