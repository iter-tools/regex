import { AST as T } from 'regexpp';

export type Expression = T.Pattern | T.Group | T.CapturingGroup | T.LookaroundAssertion;

export type Visit<R> = (node: T.Node) => R;

export interface Visitors<R> {
  RegExpLiteral?: (node: T.RegExpLiteral, visit: Visit<R>) => R;
  Pattern?: (node: T.Pattern, visit: Visit<R>) => R;
  Alternative?: (node: T.Alternative, visit: Visit<R>) => R;
  Group?: (node: T.Group, visit: Visit<R>) => R;
  CapturingGroup?: (node: T.CapturingGroup, visit: Visit<R>) => R;
  Assertion?: (node: T.Assertion, visit: Visit<R>) => R;
  Quantifier?: (node: T.Quantifier, visit: Visit<R>) => R;
  CharacterClass?: (node: T.CharacterClass, visit: Visit<R>) => R;
  CharacterClassRange?: (node: T.CharacterClassRange, visit: Visit<R>) => R;
  CharacterSet?: (node: T.CharacterSet, visit: Visit<R>) => R;
  Character?: (node: T.Character, visit: Visit<R>) => R;
  Backreference?: (node: T.Backreference, visit: Visit<R>) => R;
  Flags?: (node: T.Flags, visit: Visit<R>) => R;
}

export { RegExpParser as Parser } from 'regexpp';

export class SimpleVisitor<R> {
  private readonly visitors: Visitors<R>;

  public constructor(visitors: Visitors<R>) {
    this.visitors = visitors;
  }

  public visit = (node: T.Node): R => {
    return this.visitors[node.type]!(node as any, this.visit);
  };
}

export function visit<R>(node: T.Node, visitors: Visitors<R>): R {
  return new SimpleVisitor(visitors).visit(node);
}

export const literalNames = {
  digit: '\\d',
  space: '\\s',
  word: '\\w',
};
