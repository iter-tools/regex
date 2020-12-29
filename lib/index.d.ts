export type Pattern = {
  matcher: (...args: Array<never>) => never;
  source: string;
  flags: string;
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
};

export declare const parse: (pattern: string, flags: string) => Pattern;

export declare const exec: (pattern: string | Pattern, input: Iterable<string>) => Array<string>;
export declare const test: (pattern: string | Pattern, input: Iterable<string>) => boolean;

export declare const execGlobal: (
  pattern: string | Pattern,
  input: Iterable<string>,
) => Iterable<Array<string>>;
