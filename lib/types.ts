import { ImmutableStackFrame as Stack } from '@iter-tools/imm-stack';

export { Stack };

export type Pattern = {
  expr: ExpressionResult;
  source: string;
  flags: string;
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
};

export type MatchState = {
  result: string | null;
  captures: {
    stack: Stack<Capture>;
    list: Stack<Capture>;
  };
};

export type ExpressionResult = {
  type: 'expr';
  expr: Array<ContinuationResult>;
};

export type ContinuationResult = {
  type: 'cont';
  next: Matcher;
  state: MatchState;
};

export type SuccessResult = {
  type: 'success';
  expr: ExpressionResult | null;
  captures: Array<string | null>;
};

export type FailureResult = null;

export type Result = ContinuationResult | ExpressionResult | SuccessResult | FailureResult;

export type Matcher = {
  width: 0 | 1;
  desc: string;
  match(state: MatchState, chr?: string): Result;
};

export type UnboundMatcher = (next: Matcher) => Matcher;

export type Capture = {
  idx: number;
  start: number | null;
  end: number | null;
  result: string | null;
  parentList: Stack<Capture>;
  children: Stack<Capture>;
};
