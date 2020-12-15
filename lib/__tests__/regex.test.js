/* eslint-disable jest/expect-expect */
const { exec, parse } = require('../regex');

describe.skip('regex test', () => {
  it('[emtpy]', () => {
    const exp = parse('');
    expect(test(exp, '')).toBe(true);
    expect(test(exp, 'foo')).toBe(true);
  });

  it('f', () => {
    const exp = parse('f');
    expect(test(exp, 'f')).toBe(true);
  });

  it('foo', () => {
    const exp = parse('foo');
    expect(test(exp, '')).toBe(false);
    expect(test(exp, 'foo')).toBe(true);
    expect(test(exp, 'foof')).toBe(true);
  });

  it('f.o', () => {
    const exp = parse('f.o');
    expect(test(exp, '')).toBe(false);
    expect(test(exp, 'foo')).toBe(true);
    expect(test(exp, 'f\no')).toBe(false);
    expect(test(exp, 'foof')).toBe(true);
  });

  it('.*', () => {
    const exp = parse('.*');
    expect(test(exp, '')).toBe(true);
    expect(test(exp, 'f')).toBe(true);
    expect(test(exp, 'foo')).toBe(true);
  });

  it('\\.', () => {
    const exp = parse('\\.');
    expect(test(exp, '')).toBe(false);
    expect(test(exp, '.')).toBe(true);
    expect(test(exp, 'f')).toBe(false);
  });

  it('.*\\.', () => {
    const exp = parse('.*\\.');
    expect(test(exp, '.')).toBe(true);
    expect(test(exp, '..')).toBe(true);
  });

  it('(foo)', () => {
    const exp = parse('(foo)');
    expect(test(exp, '')).toBe(false);
    expect(test(exp, 'foo')).toBe(true);
    expect(test(exp, 'foof')).toBe(true);
  });

  it('(foo)+', () => {
    const exp = parse('(foo)+');
    expect(test(exp, '')).toBe(false);
    expect(test(exp, 'foo')).toBe(true);
    expect(test(exp, 'foof')).toBe(true);
    expect(test(exp, 'foofoo')).toBe(true);
  });
});

describe('regex exec', () => {
  it('[emtpy]', () => {
    const exp = parse('');
    expect(exec(exp, '')).toBe('');
    expect(exec(exp, 'foo')).toBe('');
  });

  it('f', () => {
    const exp = parse('f');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, 'f')).toBe('f');
    // (?:(f))
    expect(exec(exp, 'ff')).toBe('f');
    // expect(exec(exp, 'of')).toBe('f');
  });

  it('foo', () => {
    const exp = parse('foo');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, 'foo')).toBe('foo');
    expect(exec(exp, 'food')).toBe('foo');
    expect(exec(exp, 'foof')).toBe('foo');
  });

  it('(ab)', () => {
    const exp = parse('(ab)');
    expect(exec(exp, 'ab')).toBe('ab');
    expect(exec(exp, 'a')).toBe(null);
  });

  it('(a)(b)', () => {
    const exp = parse('(a)(b)');
    expect(exec(exp, 'ab')).toBe('ab');
  });

  it('a|ab', () => {
    const fExp = parse('a|ab');
    expect(exec(fExp, 'ab')).toBe('ab');
    expect(exec(fExp, 'a')).toBe('a');
    const lExp = parse('ab|a');
    expect(exec(lExp, 'ab')).toBe('ab');
    expect(exec(lExp, 'a')).toBe('a');
  });

  it('|', () => {
    expect(exec(parse('|'), '')).toBe('');
    expect(exec(parse('a|'), 'a')).toBe('a');
    expect(exec(parse('|a'), 'a')).toBe('a');
  });

  it('f.o', () => {
    const exp = parse('f.o');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, 'foo')).toBe('foo');
    expect(exec(exp, 'f\no')).toBe(null);
    expect(exec(exp, 'food')).toBe('foo');
    expect(exec(exp, 'foof')).toBe('foo');
  });

  it('.*', () => {
    const exp = parse('.*');
    expect(exec(exp, '')).toBe('');
    expect(exec(exp, 'f')).toBe('f');
    expect(exec(exp, 'foo')).toBe('foo');
  });

  it('\\.', () => {
    const exp = parse('\\.');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, '.')).toBe('.');
    expect(exec(exp, 'f')).toBe(null);
  });

  it('.*\\.', () => {
    const exp = parse('.*\\.');
    expect(exec(exp, '.')).toBe('.');
    expect(exec(exp, '..')).toBe('..');
  });

  it('(foo)', () => {
    const exp = parse('(foo)');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, 'foo')).toBe('foo');
    expect(exec(exp, 'food')).toBe('foo');
    expect(exec(exp, 'foof')).toBe('foo');
  });

  it('(ab)+', () => {
    const exp = parse('(ab)+');
    expect(exec(exp, '')).toBe(null);
    expect(exec(exp, 'ab')).toBe('ab');
    expect(exec(exp, 'aba')).toBe('ab');
    expect(exec(exp, 'abab')).toBe('abab');
  });
});
