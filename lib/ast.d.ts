/* @macrome
 * @generatedby @macrome/generator-typescript
 * @generatedfrom ./ast.ts#1646373107606
 * This file is autogenerated. Please do not edit it directly.
 * When editing run `npx macrome watch` then change the file this is generated from.
 */
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

export type { RegExpParser as Parser } from 'regexpp';

export declare class SimpleVisitor {
  private readonly visitors: Visitors<R, S>;

  constructor(visitors: Visitors<R, S>);
  visit(node: T.Node, state: S): R;
}

export declare function visit<R, S>(node: T.Node, state: S, visitors: Visitors<R, S>): R;

export declare const getCharSetDesc;

export declare const isAnchored;
