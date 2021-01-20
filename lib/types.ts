import { ImmutableStackFrame as Stack } from '@iter-tools/imm-stack';
import { ImmutableTree } from './rbt';

export { Stack };

export type Flags = {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
  unicode: boolean;
};

export type Pattern = Flags & {
  matcher: Width0Matcher;
  initialState: MatchState;
  source: string;
  flags: string;
};

export type RepetitionState = {
  min: number;
  max: number;
};

export type MatchState = {
  result: string | null;
  captureStack: Stack<Capture>;
  captureList: Stack<Capture>;
  repetitionStates: ImmutableTree<number, RepetitionState>;
};

export type ExpressionResult = {
  type: 'expr';
  expr: Array<ContinuationResult>;
};

export type ContinuationResult = {
  type: 'cont';
  next: Matcher;
};

export type SuccessResult = {
  type: 'success';
  global: boolean;
  captures: Array<string | null>;
};

export type Result = ContinuationResult | ExpressionResult | SuccessResult;

export type W0Context = {
  atStart: boolean;
  atEnd: boolean;
  idx: number;
  seenRepetitions: Array<boolean>;
};

export type Width0Matcher = {
  width: 0;
  desc: string;
  match(state: MatchState, context: W0Context): Result | null;
};

export type W1Context = Record<never, never>;
export type Width1Matcher = {
  width: 1;
  desc: string;
  match(state: MatchState, chr: string, context: W1Context): Result | null;
};

export type Context = W0Context | W1Context;
export type Matcher = Width0Matcher | Width1Matcher;

export type UnboundMatcher = (next: Matcher) => Matcher;

export type Capture = {
  idx: number;
  start: number | null;
  end: number | null;
  result: string | null;
  parentList: Stack<Capture>;
  children: Stack<Capture>;
};
