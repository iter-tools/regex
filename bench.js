const fs = require('fs');
const { execGlobal, parse } = require('./lib');

const howto = fs.readFileSync('corpus/howtosmall', 'utf-8');

const t = (exp) => {
  console.time('execGlobal');
  const [...matches] = execGlobal(exp, howto);
  console.timeEnd('execGlobal');
  return matches;
};

// URI (protocol://server/path)
// t(parse('([a-zA-Z][a-zA-Z0-9]*)://([^ /]+)(/[^ ]*)?', 'g'));

// Email (name@server)
// t(parse('([^ @]+)@([^ @]+)', 'g'));

// Date (month/day/year)
// t(parse('([0-9][0-9]?)/([0-9][0-9]?)/([0-9][0-9]([0-9][0-9])?)', 'g'));

// URI|Email
t(parse('([a-zA-Z][a-zA-Z0-9]*)://([^ /]+)(/[^ ]*)?|([^ @]+)@([^ @]+)', 'g'));
