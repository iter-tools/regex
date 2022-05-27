import type { ImmutableStackFrame as ImmutableStack } from '@iter-tools/imm-stack';
import type { ImmutableTree } from './rbt';

export { ImmutableStack };

export type RepetitionState = {
  min: number;
  max: number;
};

type PartialCapture = {
  idx: number;
  start: number;
  end: null;
  result: null;
  children: ImmutableStack<never>;
};

type CompleteCapture = {
  idx: number;
  start: number;
  end: number;
  result: string;
  children: ImmutableStack<Capture>;
};

export type Capture = PartialCapture | CompleteCapture;

export type MatcherState = {
  result: string | null;
  captureStack: ImmutableStack<ImmutableStack<Capture>>;
  repetitionStates: ImmutableTree<number, RepetitionState>;
};

export const exprType = Symbol('expr');
export const successType = Symbol('success');
export const failureType = Symbol('failure');
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

export type FailureState = {
  type: typeof failureType;
};

export type State = Matcher | ExpressionState | SuccessState | FailureState;

export type W0Context = {
  width: 0;
  lastChr: string | null;
  lastCode: number;
  nextChr: string | null;
  nextCode: number;
  seenRepetitions: Array<boolean>;
};

export type Width0Matcher = {
  type: typeof contType;
  width: 0;
  name: string;
  next: null | Matcher | Array<Matcher>;
  match(state: MatcherState, context: W0Context): State;
  props: Record<string, any>;
};

export type W1Context = {
  width: 1;
  chr: string;
  chrCode: number;
};
export type Width1Matcher = {
  type: typeof contType;
  width: 1;
  name: string;
  next: null | Matcher;
  match(state: MatcherState, context: W1Context): State;
  props: Record<string, any>;
};

export type Context = W0Context | W1Context;
export type Matcher = Width0Matcher | Width1Matcher;

export type UnboundMatcher = (next: Matcher) => Matcher;
