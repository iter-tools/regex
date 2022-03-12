export type { Pattern } from './pattern';

export type PatternLike = {
  source: string;
  flags?: string | undefined;
};

export type Flags = {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
  unicode: boolean;
};
