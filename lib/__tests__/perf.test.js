/* eslint-disable jest/expect-expect */
const fs = require('fs');
const { execGlobal, parse } = require('../index.js');

const howto = fs.readFileSync('corpus/howtosmall', 'utf-8');

describe('searching howto file', () => {
  const t = (exp) => {
    const re = new RegExp(exp.source, exp.flags);
    const expStr = re.toString();

    console.time(`execGlobal(${expStr})`);
    const [...matches] = execGlobal(exp, howto);
    console.timeEnd(`execGlobal(${expStr})`);

    console.time(`${expStr}.exec()`);
    let match;
    const nativeMatches = [];
    while ((match = re.exec(howto)) !== null) {
      nativeMatches.push([...match]);
    }
    console.timeEnd(`${expStr}.exec()`);

    expect(nativeMatches).toEqual(matches);
  };

  describe('for URI (protocol://server/path)', () => {
    it('finds matches', () => {
      t(parse('([a-zA-Z][a-zA-Z0-9]*)://([^ /]+)(/[^ ]*)?', 'g'));
    });
  });

  describe('for email (name@server):', () => {
    it('finds matches', () => {
      t(parse('([^ @]+)@([^ @]+)', 'g'));
    });
  });

  describe('for date (month/day/year):', () => {
    it('finds matches', () => {
      t(parse('([0-9][0-9]?)/([0-9][0-9]?)/([0-9][0-9]([0-9][0-9])?)', 'g'));
    });
  });

  describe('for URI|Email:', () => {
    it('finds matches', () => {
      t(parse('([a-zA-Z][a-zA-Z0-9]*)://([^ /]+)(/[^ ]*)?|([^ @]+)@([^ @]+)', 'g'));
    });
  });
});
