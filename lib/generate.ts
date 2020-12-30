import { peekerate } from 'iter-tools-es';
import { Engine } from './engine';
import { parse } from './regex';
import { Pattern } from './types';

function* generate(pattern: Pattern, iterable: Iterable<string>) {
  const peekr = peekerate(iterable);
  let engine = new Engine(pattern);
  let value, done;

  try {
    ({ value, done } = engine.next({ atStart: true, atEnd: peekr.done, chr: '', index: 0 }));
    if (done) yield value;

    while (!peekr.done) {
      const { index, value: chr } = peekr;
      ({ value, done } = engine.next({ atStart: false, atEnd: false, chr, index }));
      if (done) yield value;

      peekr.advance();
    }

    ({ value, done } = engine.next({ atStart: false, atEnd: true, chr: '', index: peekr.index }));
    if (done) yield value;
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
