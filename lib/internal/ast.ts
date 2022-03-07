import { AST as T } from 'regexpp';

export type Expression = T.Pattern | T.Group | T.CapturingGroup | T.LookaroundAssertion;

export type Visit<R> = (node: T.Node) => R;

export interface Visitors<R, S> {
  RegExpLiteral?: (node: T.RegExpLiteral, state: S, visit: Visit<R>) => R;
  Pattern?: (node: T.Pattern, state: S, visit: Visit<R>) => R;
  Alternative?: (node: T.Alternative, state: S, visit: Visit<R>) => R;
  Group?: (node: T.Group, state: S, visit: Visit<R>) => R;
  CapturingGroup?: (node: T.CapturingGroup, state: S, visit: Visit<R>) => R;
  Assertion?: (node: T.Assertion, state: S, visit: Visit<R>) => R;
  Quantifier?: (node: T.Quantifier, state: S, visit: Visit<R>) => R;
  CharacterClass?: (node: T.CharacterClass, state: S, visit: Visit<R>) => R;
  CharacterClassRange?: (node: T.CharacterClassRange, state: S, visit: Visit<R>) => R;
  CharacterSet?: (node: T.CharacterSet, state: S, visit: Visit<R>) => R;
  Character?: (node: T.Character, state: S, visit: Visit<R>) => R;
  Backreference?: (node: T.Backreference, state: S, visit: Visit<R>) => R;
  Flags?: (node: T.Flags, state: S, visit: Visit<R>) => R;
}

export { RegExpParser as Parser } from 'regexpp';

export class SimpleVisitor<R, S> {
  private readonly visitors: Visitors<R, S>;

  public constructor(visitors: Visitors<R, S>) {
    this.visitors = visitors;
  }

  public visit(node: T.Node, state: S): R {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.visitors[node.type]!(node as any, state, (node) => this.visit(node, state));
  }
}

export function visit<R, S>(node: T.Node, state: S, visitors: Visitors<R, S>): R {
  return new SimpleVisitor(visitors).visit(node, state);
}

const literalNames = {
  any: '.',
  digit: '\\d',
  space: '\\s',
  word: '\\w',
};

export const getCharSetDesc = (node: T.CharacterSet) => {
  if (node.kind === 'property') {
    return `\\p{${node.key}}`;
  } else {
    return literalNames[node.kind];
  }
};

export const isAnchored = (pattern: T.Pattern) =>
  pattern.alternatives.every((alt) => {
    if (!alt.elements.length) return false;
    const first = alt.elements[0];
    // If first is a group we could recurse but I don't see much point.
    if (first.type !== 'Assertion' || first.kind !== 'start') return false;
  });
