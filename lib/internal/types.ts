import type { ImmutableStackFrame as Stack } from '@iter-tools/imm-stack';
import type { ImmutableTree } from './rbt';

export { Stack };

export type RepetitionState = {
  min: number;
  max: number;
};

export type Capture = {
  idx: number;
  start: number | null;
  end: number | null;
  result: string | null;
  parentList: Stack<Capture>;
  children: Stack<Capture>;
};

export type MatcherState = {
  result: string | null;
  captureStack: Stack<Capture>;
  captureList: Stack<Capture>;
  repetitionStates: ImmutableTree<number, RepetitionState>;
};

export const exprType = Symbol('expr');
export const successType = Symbol('success');
export const contType = Symbol('continuation');

export type ExpressionState = {
  type: typeof exprType;
  seqs: Array<Matcher>;
};

export type SuccessState = {
  type: typeof successType;
  global: boolean;
  captures: Array<string | undefined>;
};

export type State = Matcher | ExpressionState | SuccessState;

export type W0Context = {
  lastChr: string | null;
  lastCode: number | null;
  nextChr: string | null;
  nextCode: number | null;
  seenRepetitions: Array<boolean>;
};

export type Width0Matcher = {
  type: typeof contType;
  width: 0;
  desc: string;
  match(state: MatcherState, context: W0Context): State | null;
};

export type W1Context = Record<never, never>;
export type Width1Matcher = {
  type: typeof contType;
  width: 1;
  desc: string;
  match(state: MatcherState, chr: string, chrCode: number, context: W1Context): State | null;
};

export type Context = W0Context | W1Context;
export type Matcher = Width0Matcher | Width1Matcher;

export type UnboundMatcher = (next: Matcher) => Matcher;
