import { Character, CharacterClass, CharacterClassRange, CharacterSet, Node } from 'regexpp/ast';
import { Flags } from '../types';

export const code = (str: string) => str.charCodeAt(0);
const upperValue = (c: number) => String.fromCharCode(c).toUpperCase().charCodeAt(0);
const inRange = (value: number, lo: number, hi: number) => value >= lo && value <= hi;

const c_ = code('_');
const ca = code('a');
const cz = code('z');
const cA = code('A');
const cZ = code('Z');
const c0 = code('0');
const c9 = code('9');
const cSP = code(' ');
const cCR = code('\r');
const cLF = code('\n');
const cHT = code('\t');
const cVT = code('\v');
const cFF = code('\f');

export type Tester = (c: number) => boolean;

// These definitions are mostly taken from MDN
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Character_Classes

export const testNotNewline: Tester = (c) => {
  return c !== cCR && c !== cLF && c !== 0x2028 && c !== 0x2029;
};
export const testDigit: Tester = (c) => {
  return inRange(c, c0, c9);
};
export const testSpace: Tester = (c) => {
  return (
    c === cSP ||
    c === cCR ||
    c === cLF ||
    c === cHT ||
    c === cVT ||
    c === cFF ||
    inRange(c, 0x2000, 0x200a) ||
    c === 0x00a0 ||
    c === 0x1680 ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
};
export const testWord: Tester = (c) => {
  return inRange(c, cA, cZ) || inRange(c, ca, cz) || inRange(c, c0, c9) || c === c_;
};
export const testAny: Tester = () => true;

// Because this is unimplemented
export const testProperty: Tester = () => false;

const testers = {
  digit: testDigit,
  space: testSpace,
  property: testProperty,
  word: testWord,
  any: testAny,
};

export const getCharTester = (node: Character, flags: Flags): Tester => {
  if (flags.ignoreCase) {
    const value = upperValue(node.value);
    return (c) => upperValue(c) === value;
  } else {
    const { value } = node;
    return (c) => value === c;
  }
};

export const getCharSetTester = (node: CharacterSet, flags: Flags): Tester => {
  if (node.kind === 'any' && !flags.dotAll) {
    return testNotNewline;
  } else {
    return testers[node.kind];
  }
};

export const getCharClassRangeTester = (node: CharacterClassRange, flags: Flags): Tester => {
  if (flags.ignoreCase) {
    const upperMin = upperValue(node.min.value);
    const upperMax = upperValue(node.max.value);
    return (c) => inRange(upperValue(c), upperMin, upperMax);
  } else {
    const min = node.min.value;
    const max = node.max.value;
    return (c) => inRange(c, min, max);
  }
};

export const getCharClassTester = (node: CharacterClass, flags: Flags): Tester => {
  const testers = node.elements.map((node) => getTester(node, flags));
  return (c) => testers.findIndex((tester) => tester(c)) >= 0;
};

export const getTester = (node: Node, flags: Flags): Tester => {
  switch (node.type) {
    case 'CharacterSet':
      return getCharSetTester(node, flags);
    case 'CharacterClass':
      return getCharClassTester(node, flags);
    case 'CharacterClassRange':
      return getCharClassRangeTester(node, flags);
    case 'Character':
      return getCharTester(node, flags);
    default:
      throw new Error(`${node.type} cannot be tested`);
  }
};
