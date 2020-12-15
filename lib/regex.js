const { __peekerate, __flatMap, __map, __arrayReverse } = require('iter-tools-es');
const emptyStack = require('@iter-tools/imm-stack');
const Queue = require('@iter-tools/queue');
const { when } = require('./utils.js');

/**
 * type ZeroWidthMatcher = ({
 *   type: 'a name for debugging';
 *   width: 0;
 *   match(state: MatchState): Expression;
 * });
 *
 * type OneWidthMatcher = ({
 *   type: 'a name for debugging';
 *   width: 1;
 *   match(chr: string, state: MatchState): Expression;
 * });
 *
 * type Matcher = ZeroWidthMatcher | OneWidthMatcher;
 *
 * type Expression = Array<{
 *   matcher: Matcher;
 *   state: {
 *     result: string | null;
 *     captures: {
 *       stack: Stack<Capture>;
 *       array: Array<Stack<Capture>>;
 *     };
 *   };
 * }>;
 *
 * type Capture = {
 *   idx: number,
 *   start: number | null,
 *   end: number | null,
 *   value: number | null,
 * };
 */

class MatcherQueue {
  constructor(matchers) {
    this.w0 = new Queue();
    this.w1 = new Queue();

    this.pushMatchers(matchers);
  }

  _getQueue({ matcher }) {
    if (!matcher.match) {
      throw new Error('Queue most only contain matchers');
    }
    return matcher.width === 1 ? this.w1 : this.w0;
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

const term = (matches) => ({
  type: 'term',
  width: 0,
  match: (state) => {
    if (state.result !== null) {
      matches.push(state);
    }
    return [];
  },
});

// empty state machine -- no op (needed?)
const nop = (next) => next;

// compose
const compose = (lExp, rExp) => (next) => lExp(rExp(next));

const resultStr = (result) => {
  return result === null ? '' : result;
};

const growResult = ({ result, captures }, chr) => {
  return captures.stack.size === 0 && result === null
    ? null
    : {
        result: resultStr(result) + chr,
        captures,
      };
};

// match a .
const dot = () => (next) => ({
  type: 'dot',
  width: 1,
  match: (state, chr) => {
    return when(chr !== '\n', {
      matcher: next,
      state: growResult(state, chr),
    });
  },
});

// match a character
const literal = (expected) => (next) => ({
  type: 'literal',
  width: 1,
  match: (state, chr) => {
    return when(chr === expected, {
      matcher: next,
      state: growResult(state, chr),
    });
  },
  chr: expected,
});

const merge = (matchers) => ({
  type: 'merge',
  width: 0,
  match: (state) => {
    return matchers.map((matcher) => ({
      matcher,
      state,
    }));
  },
});

const group = (seqs) => (next) => merge(seqs.map((seq) => seq(next)));

// kleene star -- match a pattern repeated 0 or more times
const star = (exp) => (next) => {
  const matcher = {
    type: '*',
    width: 0,
    match: (state) => {
      return merge([next, expMatcher]).match(state);
    },
  };

  const expMatcher = exp(matcher);

  return matcher;
};

const startCapture = (idx) => (next) => ({
  type: 'startCapture',
  width: 0,
  match: ({ result, captures }) => {
    const { stack, array } = captures;
    const capture = {
      idx,
      start: result === null ? 0 : result.length,
      end: null,
      value: null,
    };

    return [
      {
        matcher: next,
        state: {
          result: result === null ? '' : result,
          captures: {
            stack: stack.push(capture),
            array,
          },
        },
      },
    ];
  },
});

const endCapture = (idx) => (next) => ({
  type: 'endCapture',
  width: 0,
  match: ({ result, captures }) => {
    const { stack, array } = captures;
    const capture = stack.value;

    if (capture.value === null || capture.value.length < result.length) {
      array[idx] = capture;
      if (result === null) {
        capture.start = null;
      } else {
        capture.end = result.length;
        capture.value = result.slice(capture.start, capture.end);
      }
    }

    return [
      {
        matcher: next,
        state: {
          result,
          captures: {
            stack: stack.prev,
            array,
          },
        },
      },
    ];
  },
});

const capture = (idx, sequence) => {
  return compose(startCapture(idx), compose(sequence, endCapture(idx)));
};

/**
 * A group of results in a regex, either at the root of the expression or as
 * defined using parenthesis. A group may branch into multiple possible
 * sequences, and may be capturing or non-capturing.
 */
class Group {
  constructor(parentGroup = null, captureIdx = null) {
    this.parentGroup = parentGroup;
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
    const idx = this.captureIdx;
    return group([
      ...__map(__arrayReverse(this.sequences), (seq) =>
        idx === null ? seq.reduce() : capture(idx, seq.reduce()),
      ),
    ]);
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
  constructor(group) {
    this.group = group;
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
    return this.matchers.reduce(compose, nop);
  }
}

const parse = (expression, flags = '') => {
  let group = new Group();
  let { seq } = group;
  let idx = 0;

  if (flags.includes('g')) {
    throw new Error('global matching not implemented yet');
  }

  const pushGroup = () => {
    group = new Group(group, idx);
    ({ seq } = group);
    idx++;
  };

  const popGroup = () => {
    const group_ = group;
    group = group.parentGroup;
    ({ seq } = group);
    seq.push(group_.reduce());
    idx--;
  };

  // Allow the expression to seek forwards through the input for a match
  // seq.push(star(dot()));

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
      seq = group.splitSequence();
    } else {
      seq.push(literal(chr));
    }
  }

  popGroup();

  return {
    // Bind `next` arguments. The final `next` value is the terminal state.
    expression: group.reduce(),
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
  const matches = [];
  const peekr = __peekerate(iterable);

  const queue = new MatcherQueue([
    {
      matcher: expression(term(matches)),
      state: {
        result: null,
        captures: {
          stack: emptyStack,
          array: [],
        },
      },
    },
  ]);

  try {
    while (true) {
      while (queue.w0.size !== 0) {
        const { matcher, state } = queue.w0.shift();
        queue.pushMatchers(matcher.match(state));
      }

      if (queue.w1.size === 0 || peekr.done) {
        if (!matches.length) return;
        const match = matches.reduce((a, b) => (a.result.length > b.result.length ? a : b));
        const rootCapture = match.captures.array[0];
        yield match.result.slice(rootCapture.start, rootCapture.end);
        return;
        // if /g
        // state = stateFactory(expression, peekr);
      }

      const chr = peekr.value;
      const expression = [
        ...__flatMap(queue.w1, ({ matcher, state }) => matcher.match(state, chr)),
      ];
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
