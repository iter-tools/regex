import type { Flags, PatternLike } from './types';
import { buildPatternInternal } from './internal/regex';
import { Parser } from './internal/ast';

const _: unique symbol = Symbol.for('_');

export const getPatternInternal = (pattern: Pattern) => {
  return pattern[_];
};

export class Pattern implements Flags {
  private readonly [_]: ReturnType<typeof buildPatternInternal>;

  readonly source!: string;
  readonly flags!: string;
  readonly global!: boolean;
  readonly ignoreCase!: boolean;
  readonly multiline!: boolean;
  readonly dotAll!: boolean;
  readonly unicode!: boolean;
  readonly sticky!: boolean;

  constructor(pattern: PatternLike | string, flags?: string | undefined) {
    let source;
    let _flags;

    if (pattern instanceof Pattern) {
      return pattern;
    } else if (typeof pattern === 'string') {
      source = pattern;
      _flags = flags || '';
    } else {
      ({ source } = pattern);
      _flags = flags !== undefined ? flags : pattern.flags || '';
    }

    const parser = new Parser();
    parser.parseFlags(_flags); // for validation
    const ast = parser.parsePattern(source);

    const flagsObj = {
      global: _flags.includes('g'),
      ignoreCase: _flags.includes('i'),
      multiline: _flags.includes('m'),
      dotAll: _flags.includes('s'),
      unicode: _flags.includes('u'),
      sticky: _flags.includes('y'),
    };

    this[_] = buildPatternInternal(ast, flagsObj);
    this.source = source;
    this.flags = _flags;
    Object.assign(this, flagsObj);
  }
}

export const parse = (pattern: PatternLike | string, flags?: string | undefined): Pattern => {
  return new Pattern(pattern, flags);
};
