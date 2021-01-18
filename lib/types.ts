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
  context: Record<never, never>;
};

export type MatchState = {
  result: string | null;
  captures: {
    stack: Stack<Capture>;
    list: Stack<Capture>;
  };
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

export type Width0Matcher = {
  width: 0;
  desc: string;
  match(state: MatchState, context: Record<never, never>): Result | null;
};

export type Width1Matcher = {
  width: 1;
  desc: string;
  match(state: MatchState, chr: string): Result | null;
};

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
