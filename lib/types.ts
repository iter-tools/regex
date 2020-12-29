import { ImmutableStackFrame as Stack } from '@iter-tools/imm-stack';
import { Expression } from './engine';

export { Stack };

export type Pattern = {
  matcher: Matcher;
  source: string;
  flags: string;
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
};

export type State = {
  result: string | null;
  captures: {
    stack: Stack<Capture>;
    list: Stack<Capture>;
  };
};

export type ExpressionResult = {
  type: 'expr';
  expr: Expression;
};

export type ContinuationResult = {
  type: 'cont';
  next: Matcher;
  state: State;
};

export type SuccessResult = {
  type: 'success';
  result: string;
  capture: Capture;
};

export type FailureResult = {
  type: 'failure';
};

export type Result = ContinuationResult | ExpressionResult | SuccessResult | FailureResult;

export type Matcher = {
  width: 0 | 1;
  desc: string;
  match(state: State, chr?: string): Result;
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
