/* @macrome
 * @generatedby @macrome/generator-typescript
 * @generatedfrom ./types.ts#1648561484665
 * This file is autogenerated. Please do not edit it directly.
 * When editing run `npx macrome watch` then change the file this is generated from.
 */
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
  sticky: boolean;
};
