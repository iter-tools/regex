/* eslint-disable jest/expect-expect */
const { exec, execGlobal, parse } = require('../index.ts');

describe('exec', () => {
  it('[emtpy]', () => {
    const exp = parse('');
    expect(exec(exp, '')).toEqual(['']);
    expect(exec(exp, 'f')).toEqual(['']);
  });

  it('f', () => {
    const exp = parse('f');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, 'ff')).toEqual(['f']);
    expect(exec(exp, 'of')).toEqual(['f']);
  });

  it('^f', () => {
    const exp = parse('^f');
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, 'ff')).toEqual(['f']);
    expect(exec(exp, 'of')).toEqual(null);
  });

  it('f$', () => {
    const exp = parse('f$');
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, 'fo')).toEqual(null);
    expect(exec(exp, 'of')).toEqual(['f']);
  });

  it('foo', () => {
    const exp = parse('foo');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'foo')).toEqual(['foo']);
    expect(exec(exp, 'food')).toEqual(['foo']);
    expect(exec(exp, 'foof')).toEqual(['foo']);
  });

  it('()', () => {
    const exp = parse('()');
    expect(exec(exp, '')).toEqual(['', '']);
    expect(exec(exp, 'a')).toEqual(['', '']);
  });

  it('(ab)', () => {
    const exp = parse('(ab)');
    expect(exec(exp, 'ab')).toEqual(['ab', 'ab']);
    expect(exec(exp, 'a')).toEqual(null);
  });

  it('(a)(b)', () => {
    const exp = parse('(a)(b)');
    expect(exec(exp, 'ab')).toEqual(['ab', 'a', 'b']);
  });

  it('a|ab', () => {
    const fExp = parse('a|ab');
    expect(exec(fExp, 'ab')).toEqual(['a']);
    expect(exec(fExp, 'a')).toEqual(['a']);
    const lExp = parse('ab|a');
    expect(exec(lExp, 'ab')).toEqual(['ab']);
    expect(exec(lExp, 'a')).toEqual(['a']);
  });

  it('|', () => {
    expect(exec(parse('|'), '')).toEqual(['']);
    expect(exec(parse('a|'), 'a')).toEqual(['a']);
    expect(exec(parse('|a'), 'a')).toEqual(['']);
  });

  it('f.o', () => {
    const exp = parse('f.o');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'foo')).toEqual(['foo']);
    expect(exec(exp, 'f\no')).toEqual(null);
    expect(exec(exp, 'food')).toEqual(['foo']);
    expect(exec(exp, 'foof')).toEqual(['foo']);
  });

  it('.*', () => {
    const exp = parse('.*');
    expect(exec(exp, '')).toEqual(['']);
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, 'foo')).toEqual(['foo']);
  });

  it('(.*)*', () => {
    const exp = parse('(.*)*');
    expect(exec(exp, '')).toEqual(['', undefined]);
    expect(exec(exp, 'f')).toEqual(['f', 'f']);
  });

  it('\\.', () => {
    const exp = parse('\\.');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, '.')).toEqual(['.']);
    expect(exec(exp, 'f')).toEqual(null);
  });

  it('.*\\.', () => {
    const exp = parse('.*\\.');
    expect(exec(exp, '.')).toEqual(['.']);
    expect(exec(exp, '..')).toEqual(['..']);
  });

  it('(foo)', () => {
    const exp = parse('(foo)');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'foo')).toEqual(['foo', 'foo']);
    expect(exec(exp, 'food')).toEqual(['foo', 'foo']);
    expect(exec(exp, 'foof')).toEqual(['foo', 'foo']);
  });

  it('(ab)+', () => {
    const exp = parse('(ab)+');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'ab')).toEqual(['ab', 'ab']);
    expect(exec(exp, 'aba')).toEqual(['ab', 'ab']);
    expect(exec(exp, 'abab')).toEqual(['abab', 'ab']);
  });

  it('(ab|a)+', () => {
    const exp = parse('(ab|a)+');
    expect(exec(exp, 'aab')).toEqual(['aab', 'ab']);
    expect(exec(exp, 'aba')).toEqual(['aba', 'a']);
    expect(exec(exp, 'abc')).toEqual(['ab', 'ab']);
  });

  it('(a)|', () => {
    const exp = parse('(a)|');
    expect(exec(exp, 'a')).toEqual(['a', 'a']);
    expect(exec(exp, 'b')).toEqual(['', undefined]);
  });

  it('f{1,2}', () => {
    const exp = parse('f{1,2}');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, 'ff')).toEqual(['ff']);
    expect(exec(exp, 'fff')).toEqual(['ff']);
  });

  it('(f{1,2})*', () => {
    const exp = parse('(f{1,2})*');
    expect(exec(exp, 'f')).toEqual(['f', 'f']);
    expect(exec(exp, 'ff')).toEqual(['ff', 'ff']);
    expect(exec(exp, 'fff')).toEqual(['fff', 'f']);
    expect(exec(exp, 'ffff')).toEqual(['ffff', 'ff']);
  });

  it('(h{1,2}a)*', () => {
    const exp = parse('(h{1,2}a)*');
    expect(exec(exp, 'hahaha')).toEqual(['hahaha', 'ha']);
  });

  it('()*', () => {
    const exp = parse('()*');
    expect(exec(exp, '')).toEqual(['', undefined]);
  });

  it('\\w', () => {
    const exp = parse('\\w');
    expect(exec(exp, ' ')).toEqual(null);
    expect(exec(exp, '0')).toEqual(['0']);
    expect(exec(exp, '1')).toEqual(['1']);
    expect(exec(exp, '9')).toEqual(['9']);
    expect(exec(exp, 'a')).toEqual(['a']);
    expect(exec(exp, 'b')).toEqual(['b']);
    expect(exec(exp, 'z')).toEqual(['z']);
    expect(exec(exp, 'A')).toEqual(['A']);
    expect(exec(exp, 'B')).toEqual(['B']);
    expect(exec(exp, 'Z')).toEqual(['Z']);
    expect(exec(exp, '_')).toEqual(['_']);
  });

  it('\\W', () => {
    const exp = parse('\\W');
    expect(exec(exp, ' ')).toEqual([' ']);
    expect(exec(exp, '0')).toEqual(null);
  });

  it('\\d', () => {
    const exp = parse('\\d');
    expect(exec(exp, 'd')).toEqual(null);
    expect(exec(exp, '0')).toEqual(['0']);
    expect(exec(exp, '1')).toEqual(['1']);
    expect(exec(exp, '9')).toEqual(['9']);
  });

  it('\\D', () => {
    const exp = parse('\\D');
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, '0')).toEqual(null);
  });

  it('\\s', () => {
    const exp = parse('\\s');
    expect(exec(exp, 's')).toEqual(null);
    expect(exec(exp, ' ')).toEqual([' ']);
    expect(exec(exp, '\u2028')).toEqual(['\u2028']);
  });

  it('\\S', () => {
    const exp = parse('\\S');
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, ' ')).toEqual(null);
  });

  it('\\b', () => {
    const exp = parse('\\b');
    expect(exec(exp, '')).toEqual(null);
    expect(exec(exp, ' ')).toEqual(null);
    expect(exec(exp, 'f')).toEqual(['']);
  });

  it('\\bf\\b', () => {
    const exp = parse('\\bf\\b');
    expect(exec(exp, 'f')).toEqual(['f']);
    expect(exec(exp, ' f ')).toEqual(['f']);
    expect(exec(exp, 'ofo')).toEqual(null);
  });
});

describe('execGlobal', () => {
  describe('when pattern is not global', () => {
    it('.', () => {
      const exp = parse('.');
      expect([...execGlobal(exp, 'abc')]).toEqual([['a']]);
    });
  });

  describe('when pattern is global', () => {
    it('.', () => {
      const exp = parse('.', 'g');
      expect([...execGlobal(exp, 'abc')]).toEqual([['a'], ['b'], ['c']]);
    });

    it('ab|a', () => {
      const exp = parse('ab|a', 'g');
      expect([...execGlobal(exp, 'aa')]).toEqual([['a'], ['a']]);
    });

    it('abb|a', () => {
      const exp = parse('abb|a', 'g');
      expect([...execGlobal(exp, 'aa')]).toEqual([['a'], ['a']]);
    });
  });
});
