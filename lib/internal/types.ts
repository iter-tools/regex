import type { ImmutableStackFrame as ImmutableStack } from '@iter-tools/imm-stack';
import type { ImmutableTree } from './rbt';

export { ImmutableStack };

export type RepetitionState = {
  min: number;
  max: number;
};

export type Capture = {
  children: ImmutableStack<Capture>;
  idx: number;
  start: number | null;
  end: number | null;
  result: string | null;
};

// Sequence state is mutable! Expressions make copies.
export type SequenceState = {
  result: string | null;
  // A stack of the captures we are currently nested inside
  parentCaptures: ImmutableStack<Capture>;
  // The current capture.
  // Not on the stack because if it was we'd throw away the root capture before we hit term!
  capture: Capture;
  repetitionStates: ImmutableTree<number, RepetitionState>;
};

export const contType = Symbol('continuation');
export const exprType = Symbol('expr');
export const successType = Symbol('success');

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
  name: string;
  next: null | Matcher | Array<Matcher>;
  match(state: SequenceState, context: W0Context): State | null;
  props: Record<string, any>;
};

export type W1Context = Record<never, never>;
export type Width1Matcher = {
  type: typeof contType;
  width: 1;
  name: string;
  next: null | Matcher;
  match(state: SequenceState, chr: string, chrCode: number, context: W1Context): State | null;
  props: Record<string, any>;
};

export type Context = W0Context | W1Context;
export type Matcher = Width0Matcher | Width1Matcher;

export type UnboundMatcher = (next: Matcher) => Matcher;
