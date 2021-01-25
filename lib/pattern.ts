import { MatchState, Width0Matcher } from './types';

export class Pattern {
  readonly source!: string;
  readonly flags!: string;
  readonly global!: boolean;
  readonly ignoreCase!: boolean;
  readonly multiline!: boolean;
  readonly dotAll!: boolean;
  readonly unicode!: boolean;
  readonly matcher!: Width0Matcher;
  readonly initialState!: MatchState;
}

export const asPattern = (pattern: Pattern): Pattern => {
  return Object.assign(Object.create(Pattern.prototype), pattern);
};
