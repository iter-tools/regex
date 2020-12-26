const { __peekerate, __flatMap } = require('iter-tools-es');
const emptyStack = require('@iter-tools/imm-stack');
const Queue = require('@iter-tools/queue');
const { when } = require('./utils.js');
const { flattenCapture } = require('./captures.js');

class MatcherQueue {
  constructor(matchers) {
    this.w0 = new Queue();
    this.w1 = new Queue();

    this.pushMatchers(matchers);
  }

  _getQueue({ next, state }) {
    if (!next.match) {
      throw new Error('Queue must only contain matchers');
    }
    if (state == null) {
      throw new Error('State must not be null');
    }
    return next.width === 1 ? this.w1 : this.w0;
  }

  pushMatchers(matchers) {
    for (const matcher of matchers) {
      this._getQueue(matcher).push(matcher);
    }
  }

  get size() {
    return this.w0.size + this.w1.size;
  }
}

const term = () => ({
  width: 0,
  type: 'term',
  match: (state) => {
    const { matches, result } = state;
    if (result !== null) {
      matches.push(state);
    }
    return [];
  },
});

const identity = (next) => next;

const compose = (lExp, rExp) => (next) => lExp(rExp(next));

const resultStr = (result) => {
  return result === null ? '' : result;
};

const growResult = (state, chr) => {
  const { result, captures } = state;
  return captures.stack.size === 0 && result === null
    ? state
    : {
        ...state,
        result: resultStr(result) + chr,
      };
};

// match a .
const dot = () => (next) => ({
  width: 1,
  type: 'dot',
  match: (state, chr) => {
    return when(chr !== '\n', {
      next,
      state: growResult(state, chr),
    });
  },
});

// match a character
const literal = (expected) => (next) => ({
  width: 1,
  type: 'literal',
  match: (state, chr) => {
    return when(chr === expected, {
      next,
      state: growResult(state, chr),
    });
  },
  chr: expected,
});

const merge = (matchers) => ({
  width: 0,
  type: 'merge',
  match: (state) => {
    return matchers.map((next) => ({
      next,
      state,
    }));
  },
});

const expression = (seqs) => (next) => merge(seqs.map((seq) => seq(next)));

// kleene star -- match a pattern repeated 0 or more times
const star = (exp) => (next) => {
  const matcher = {
    width: 0,
    type: '*',
    match: (state) => {
      return merge([next, expMatcher]).match(state);
    },
  };

  const expMatcher = exp(matcher);

  return matcher;
};

const startCapture = (idx) => (next) => ({
  width: 0,
  type: 'startCapture',
  match: (state) => {
    const { result, captures } = state;
    let { stack, list: parentList } = captures;

    const list = emptyStack;

    const capture = {
      idx,
      start: result === null ? 0 : result.length,
      end: null,
      value: null,
      parentList,
      children: list,
    };

    stack = stack.push(capture);

    return [
      {
        next,
        state: {
          ...state,
          result: result === null ? '' : result,
          captures: { stack, list },
        },
      },
    ];
  },
});

const endCapture = () => (next) => ({
  width: 0,
  type: 'endCapture',
  match: (state) => {
    const { result, captures } = state;
    const { stack, list: children } = captures;

    let capture = stack.value;

    if (result === null) {
      capture = {
        ...capture,
        start: null,
      };
    } else {
      const { start } = capture;
      const end = result.length;
      const value = result.slice(start, end);
      capture = {
        ...capture,
        end,
        value,
        children,
      };
    }

    let { parentList } = capture;

    if (capture.value !== null && parentList.size && parentList.value.idx === capture.idx) {
      // Subsequent matches of the same capture group overwrite
      parentList = parentList.prev;
    }

    return [
      {
        next,
        state: {
          ...state,
          result,
          captures: {
            stack: stack.prev,
            list: parentList.push(capture),
          },
        },
      },
    ];
  },
});

const capture = (idx, exp) => {
  return compose(startCapture(idx), compose(exp, endCapture()));
};

/**
 * An expression is either the root of the regex or a group.
 * It may branch into multiple possible sequences, and may be capturing
 * or non-capturing.
 */
class Expression {
  constructor(parent = null, captureIdx = null) {
    this.parent = parent;
    this.captureIdx = captureIdx; // null is non-capturing
    this.sequences = [new Sequence(this)];
  }

  get seq() {
    return this.sequences[this.sequences.length - 1];
  }

  splitSequence() {
    const seq = new Sequence(this);
    this.sequences.push(seq);
    return seq;
  }

  reduce() {
    const { sequences, captureIdx: idx } = this;
    const exp = expression(sequences.map((sequence) => sequence.reduce()));
    return idx === null ? exp : capture(idx, exp);
  }
}

/**
 * A collection of matchers which succeed or fail together when applied
 * to subsequent characters of the input. A sequence does not branch,
 * but it may contain groups which do contain branches.
 *
 * A simple sequence might be the pattern `abc` or `ab+`
 */
class Sequence {
  constructor(expression) {
    this.expression = expression;
    this.matchers = [];
  }

  get last() {
    return this.matchers[this.matchers.length - 1];
  }

  push(value) {
    this.matchers.push(value);
  }

  modify(cb) {
    const { matchers } = this;
    matchers[matchers.length - 1] = cb(matchers[matchers.length - 1]);
  }

  reduce() {
    return this.matchers.reduce(compose, identity);
  }
}

const parse = (expression, flags = '') => {
  let exp = new Expression();
  let { seq } = exp;
  let idx = 0;

  if (flags.includes('g')) {
    throw new Error('global matching not implemented yet');
  }

  const pushGroup = () => {
    exp = new Expression(exp, idx++);
    ({ seq } = exp);
  };

  const popGroup = () => {
    const exp_ = exp;
    exp = exp.parent;
    ({ seq } = exp);
    seq.push(exp_.reduce());
  };

  // Allow the expression to seek forwards through the input for a match
  seq.push(star(dot()));

  // Create the expression (root) capture
  pushGroup();

  let escaped = false;
  for (const chr of expression) {
    if (chr === '\\') {
      escaped = !escaped;
    } else if (escaped) {
      seq.push(literal(chr));

      escaped = false;
    } else if (chr === '.') {
      seq.push(dot());
    } else if (chr === '*') {
      seq.modify(star);
    } else if (chr === '+') {
      seq.push(seq.last);
      seq.modify(star);
    } else if (chr === '(') {
      pushGroup();
    } else if (chr === ')') {
      popGroup();
    } else if (chr === '|') {
      seq = exp.splitSequence();
    } else {
      seq.push(literal(chr));
    }
  }

  popGroup();

  return {
    // Bind `next` arguments. The final `next` value is the terminal state.
    expression: exp.reduce()(term()),
    source: expression,
    flags,
    global: flags.includes('g'),
    ignoreCase: flags.includes('i'),
    multiline: flags.includes('m'),
    dotAll: flags.includes('s'),
  };
};

function* generate(pattern, iterable) {
  const { expression } = pattern;
  const peekr = __peekerate(iterable);
  const matches = [];

  const queue = new MatcherQueue([
    {
      next: expression,
      state: {
        matches,
        result: null,
        captures: {
          stack: emptyStack,
          list: emptyStack,
        },
      },
    },
  ]);

  try {
    while (true) {
      while (queue.w0.size !== 0) {
        const { next, state } = queue.w0.shift();
        queue.pushMatchers(next.match(state));
      }

      if (queue.w1.size === 0 || peekr.done) {
        if (!matches.length) return;
        const matchState = matches.reduce((a, b) => (a.result.length > b.result.length ? a : b));
        const rootCapture = matchState.captures.list.value;
        yield [...flattenCapture(rootCapture)];
        return;
        // if /g
        // state = stateFactory(expression, peekr);
      }

      const chr = peekr.value;
      const expression = [...__flatMap(queue.w1, ({ next, state }) => next.match(state, chr))];
      queue.w1.clear();
      queue.pushMatchers(expression);

      peekr.advance();
    }
  } finally {
    peekr.return();
  }
}

function exec(pattern, iterable) {
  const step = generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable).next();

  return step.done ? null : step.value;
}

function test(pattern, iterable) {
  return exec(pattern, iterable) !== null;
}

module.exports = { parse, exec, generate, test };
