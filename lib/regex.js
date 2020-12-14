const { __peekerate, __reduce, __map, __arrayReverse } = require('iter-tools');
const emptyStack = require('@iter-tools/imm-stack');
const Queue = require('@iter-tools/queue');

class MatcherQueue {
  constructor(values) {
    this.w0 = new Queue();
    this.w1 = new Queue();

    this.push(...values);
  }

  _getQueue(matcher) {
    return matcher.width === 1 ? this.w1 : this.w0;
  }

  push(...matchers) {
    for (const matcher of matchers) {
      this._getQueue(matcher).push(matcher);
    }
  }

  get size() {
    return this.w0.size + this.w1.size;
  }
}

const joinResult = (a, b) => {
  if (b === null) return null;
  return (a === null ? '' : a) + (b === null ? '' : b);
};

// pattern terminal state -- the pattern has matched fully
const term = {
  type: 'term',
  width: 0,
  match: (result, captures) => ({ result, captures, matchers: [] }),
};

// the opposite of branch
const merge = (lMatcher, rMatcher) => ({
  type: 'merge',
  width: 1,
  match: (chr, result, captures) => {
    const lNext = lMatcher.match(chr, result, captures);
    const rNext = rMatcher.match(chr, result, captures);

    const acceptRight = lNext.result === null && rNext.result !== null;
    const accepted = acceptRight ? rNext : lNext;

    return {
      ...accepted,
      matchers: [...lNext.matchers, ...rNext.matchers],
    };
  },
});

// empty state machine -- no op (needed?)
const nop = (next) => next;

// compose
const compose = (lExp, rExp) => (next) => lExp(rExp(next));

// pursue two possible matches independently
const branch = (lExp, rExp) => {
  return (next) => merge(lExp(next), rExp(next));
};

// match a .
const dot = (expected) => (next) => ({
  type: 'literal',
  width: 1,
  match: (chr, result, captures) => {
    const matches = chr !== '\n';
    return {
      result: matches ? joinResult(result, chr) : null,
      captures,
      matchers: matches ? [next] : [],
    };
  },
  chr: expected,
});

// match a character
const literal = (expected) => (next) => ({
  type: 'literal',
  width: 1,
  match: (chr, result, captures) => {
    const matches = chr === expected;
    return {
      result: matches ? joinResult(result, chr) : null,
      captures,
      matchers: matches ? [next] : [],
    };
  },
  chr: expected,
});

// kleene star -- match a pattern repeated 0 or more times
const star = (exp, defaultResult = '') => (next) => {
  let cycle = false;
  let self = null;
  const loop = merge(
    {
      type: '*',
      width: 1,
      match: (chr, result, captures) => {
        if (cycle) {
          return { result: '', captures, matchers: [] };
        } else {
          cycle = true;
          // We should be matching
          const match = self.match(chr, result);
          cycle = false;
          return {
            // force result because star can always match nothing
            // result: joinResult(result, match.result === null ? defaultResult : match.result),
            result: match.result === null ? defaultResult : match.result,
            captures,
            matchers: match.matchers,
          };
        }
      },
    },
    next,
  );
  self = exp(loop);
  return loop;
};

const startCapture = (idx) => (next) => ({
  type: 'startCapture',
  width: 0,
  match: (result, captures) => {
    const { stack, array } = captures;
    const capture = {
      idx,
      start: result === null ? 0 : result.length,
      end: null,
      value: null,
    };
    array[idx] = capture;

    // return next.match(chr, result, captures.push(capture));
    return {
      result: result === null ? '' : result,
      captures: {
        stack: stack.push(capture),
        array,
      },
      matchers: [next],
    };
  },
});

const endCapture = (idx) => (next) => ({
  type: 'endCapture',
  width: 0,
  match: (result, captures) => {
    const { stack, array } = captures;
    const capture = stack.value;
    if (capture.end === null) {
      if (result === null) {
        capture.start = null;
      } else {
        capture.end = result.length;
        capture.value = result.slice(capture.start, capture.end);
      }
    }

    return {
      result,
      captures: {
        stack: stack.prev,
        array,
      },
      matchers: [next],
    };
  },
});

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
    const reduced =
      this.sequences.length === 0
        ? nop()
        : __reduce(
            __map(__arrayReverse(this.sequences), (seq) => seq.reduce()),
            branch,
          );
    if (idx === null) {
      return reduced;
    } else {
      return idx === null ? reduced : compose(startCapture(idx), compose(reduced, endCapture(idx)));
    }
  }
}

// const startSequence = (cache) => (next) => ({
//   type: 'startSequence',
//   width: 0,
//   match: (result, captures) => {
//     // cache.captures = captures;
//     return {
//       result,
//       captures,
//       matchers: [next],
//     };
//   },
// });

// const endSequence = (cache) => (next) => ({
//   type: 'endSequence',
//   width: 0,
//   match: (result, captures) => {
//     return {
//       result,
//       captures,
//       // captures: result !== null ? captures : cache.captures,
//       matchers: [next],
//     };
//   },
// });

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
    return this.sequences[this.sequences.length - 1];
  }

  push(value) {
    this.matchers.push(value);
  }

  pushGroup(idx) {
    return new Group(this.group, idx);
  }

  popGroup() {
    const { parentGroup } = this.group;
    const parentSeq = parentGroup.seq;
    parentSeq.push(this.group.reduce());
    return parentGroup;
  }

  modify(cb) {
    const { matchers } = this;
    matchers[matchers.length - 1] = cb(matchers[matchers.length - 1]);
  }

  reduce() {
    // const cache = {};
    // const reduced = reduce(arrayReverse(this.matchers), compose, nop);
    const reduced = this.matchers.length === 0 ? nop : __reduce(this.matchers, compose);
    // return compose(startSequence(cache), compose(reduced, endSequence(cache)));
    return reduced;
  }
}

const parse = (expression, flags = '') => {
  let group = new Group();
  let { seq } = group;
  let idx = 0;

  const pushGroup = () => {
    group = seq.pushGroup(idx);
    ({ seq } = group);
    idx++;
  };

  const popGroup = () => {
    group = seq.popGroup(idx);
    ({ seq } = group);
    idx--;
  };

  // Allow the expression to seek forwards through the input for a match
  // seq.push(star(padding(), null));

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
    expression: group.reduce()(term),
    source: expression,
    flags,
    ignoreCase: flags.includes('i'),
    multiline: flags.includes('m'),
    dotAll: flags.includes('s'),
  };
};

const matchFound = (captures) => {
  const { array, stack } = captures;
  return stack.size === 0 && array[0].value !== null;
};

const match = (matcher, state) => {
  const match =
    matcher.width === 0
      ? matcher.match(state.result, state.captures)
      : matcher.match(state.peekr.value, state.result, state.captures);

  state.result = match.result;
  state.captures = match.captures;
  state.queue.push(...match.matchers);
};

const stateFactory = (expression, peekr) => {
  return {
    result: '',
    captures: {
      stack: emptyStack,
      array: [],
    },
    queue: new MatcherQueue([expression]),
    peekr,
  };
};

function* _generate(pattern, iterable) {
  const { expression } = pattern;
  const peekr = __peekerate(iterable);
  let state = stateFactory(expression, peekr);

  try {
    while (true) {
      while (state.queue.w0.size) {
        match(state.queue.w0.shift(), state);
      }

      if (state.queue.size === 0 && matchFound(state.captures)) {
        const rootCapture = state.captures.array[0];
        yield state.result.slice(rootCapture.start, rootCapture.end);
        // if /g
        state = stateFactory(expression, peekr);
      }

      if (peekr.done) break;

      if (state.queue.w1.size) {
        match(__reduce(state.queue.w1, merge), state);
        peekr.advance();
      }
    }
  } finally {
    peekr.return();
  }
}

function generate(pattern, iterable) {
  return _generate(typeof pattern === 'string' ? parse(pattern) : pattern, iterable);
}

function exec(pattern, iterable) {
  const step = generate(pattern, iterable).next();

  return step.done ? null : step.value;
}

function test(matcher, iterable) {
  return exec(matcher, iterable) !== null;
}

module.exports = { parse, exec, generate, test };
