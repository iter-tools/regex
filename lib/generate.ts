import { peekerate } from 'iter-tools-es';
import { Engine } from './engine';
import { parse } from './regex';
import { Pattern } from './types';

function* generate(pattern: Pattern, iterable: Iterable<string>) {
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
}

export const exec = (pattern: string | Pattern, iterable: Iterable<string>) => {
  const step = generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable).next();

  return step.done ? null : step.value;
};

export const test = (pattern: string, iterable: Iterable<string>) => {
  return exec(pattern, iterable) !== null;
};

export const execGlobal = (pattern: string | Pattern, iterable: Iterable<string>) => {
  return generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable);
};
