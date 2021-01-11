export const code = (str: string) => str.charCodeAt(0);
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

// These definitions are mostly taken from MDN
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Character_Classes

const testNewline = (c: number) => {
  return c === cCR || c === cLF || c === 0x2028 || c === 0x2029;
};
const testDigit = (c: number) => {
  return inRange(c, c0, c9);
};
const testSpace = (c: number) => {
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
const testWord = (c: number) => {
  return inRange(c, cA, cZ) || inRange(c, ca, cz) || inRange(c, c0, c9) || c === c_;
};
const testAny = (c: number) => true;

export const testers = {
  newline: testNewline,
  digit: testDigit,
  space: testSpace,
  word: testWord,
  any: testAny,
};
