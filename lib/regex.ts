import emptyStack from '@iter-tools/imm-stack';
import { map } from './utils';
import { FailureResult, Matcher, Pattern, Result, State, UnboundMatcher } from './types';

const fail: FailureResult = {
  type: 'failure',
};

const when = (condition: boolean, value: Result) => {
  return condition ? value : fail;
};

const identity: UnboundMatcher = (next) => next;

const compose = (lExp: UnboundMatcher, rExp: UnboundMatcher) => {
  return (next: Matcher) => lExp(rExp(next));
};

const growResult = (state: State, chr: string): State => {
  const { result, captures } = state;
  return captures.stack.size === 0 && result === null
    ? state
    : {
        ...state,
        result: result + chr,
      };
};

const term = (): Matcher => ({
  width: 0,
  desc: 'term',
  match: (state: State) => {
    const { result, captures } = state;
    return result !== null
      ? {
          type: 'success',
          result,
          capture: captures.list.value,
        }
      : fail;
  },
});

// match a .
const dot = (): UnboundMatcher => (next: Matcher) => ({
  width: 1,
  desc: 'dot',
  match: (state, chr: string) => {
    return when(chr !== '\n', {
      type: 'cont',
      next,
      state: growResult(state, chr),
    });
  },
});

// match a character
const literal = (expected: string): UnboundMatcher => (next) => ({
  width: 1,
  desc: 'literal',
  match: (state, chr: string) => {
    return when(chr === expected, {
      type: 'cont',
      next,
      state: growResult(state, chr),
    });
  },
  chr: expected,
});

const expression = (seqs: Array<UnboundMatcher>): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'expression',
  match: (state) => {
    return seqs.length
      ? {
          type: 'seqs',
          seqs: map(seqs, (seq) => ({
            type: 'cont',
            next: seq(next),
            state,
          })),
        }
      : {
          type: 'cont',
          next,
          state,
        };
  },
});

// kleene star -- match a pattern repeated 0 or more times
const star = (exp: UnboundMatcher, greedy = true): UnboundMatcher => (next) => {
  const matcher = {
    desc: '*',
    width: 0 as const,
    match: (state: State): Result => {
      const matchers = greedy ? [expMatcher, next] : [next, expMatcher];
      return {
        type: 'seqs',
        seqs: map(matchers, (matcher) => ({
          type: 'cont',
          next: matcher,
          state,
        })),
      };
    },
  };

  const expMatcher = exp(matcher);

  return matcher;
};

const startCapture = (idx: number): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'startCapture',
  match: (state) => {
    const { result, captures } = state;
    let { stack, list: parentList } = captures;

    const list = emptyStack;

    const capture = {
      idx,
      start: result === null ? 0 : result.length,
      end: null,
      result: null,
      parentList,
      children: list,
    };

    stack = stack.push(capture);

    return {
      type: 'cont',
      next,
      state: {
        ...state,
        result: result === null ? '' : result,
        captures: { stack, list },
      },
    };
  },
});

const endCapture = (): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'endCapture',
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

      capture = {
        ...capture,
        end,
        result: result.slice(start!, end),
        children,
      };
    }

    let { parentList } = capture;

    if (capture.result !== null && parentList.size && parentList.value.idx === capture.idx) {
      // Subsequent matches of the same capture group overwrite
      parentList = parentList.prev;
    }

    return {
      type: 'cont',
      next,
      state: {
        ...state,
        result,
        captures: {
          stack: stack.prev,
          list: parentList.push(capture),
        },
      },
    };
  },
});

const capture = (idx: number, exp: UnboundMatcher) => {
  return compose(startCapture(idx), compose(exp, endCapture()));
};

/**
 * An expression is either the root of the regex or a group.
 * It may branch into multiple possible sequences, and may be capturing
 * or non-capturing.
 */
class PatternExpression {
  parent: PatternExpression | null;
  captureIdx: number | null;
  sequences: Array<PatternSequence>;

  constructor(parent: PatternExpression | null = null, captureIdx: number | null = null) {
    this.parent = parent;
    this.captureIdx = captureIdx; // null is non-capturing
    this.sequences = [new PatternSequence(this)];
  }

  get seq() {
    return this.sequences[this.sequences.length - 1];
  }

  splitSequence() {
    const seq = new PatternSequence(this);
    this.sequences.push(seq);
    return seq;
  }

  reduce(): UnboundMatcher {
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
class PatternSequence {
  expression: PatternExpression;
  matchers: Array<UnboundMatcher>;

  constructor(expression: PatternExpression) {
    this.expression = expression;
    this.matchers = [];
  }

  get last() {
    return this.matchers[this.matchers.length - 1];
  }

  push(value: UnboundMatcher) {
    this.matchers.push(value);
  }

  modify(cb: (matcher: UnboundMatcher) => UnboundMatcher) {
    const { matchers } = this;
    matchers[matchers.length - 1] = cb(matchers[matchers.length - 1]);
  }

  reduce(): UnboundMatcher {
    return this.matchers.reduce(compose, identity);
  }
}

export const parse = (expression: string, flags = ''): Pattern => {
  let exp = new PatternExpression();
  let { seq } = exp;
  let idx = 0;

  if (flags.includes('g')) {
    throw new Error('global matching not implemented yet');
  }

  const pushExpression = () => {
    exp = new PatternExpression(exp, idx++);
    ({ seq } = exp);
  };

  const popExpression = () => {
    const exp_ = exp;
    exp = exp.parent as PatternExpression;
    ({ seq } = exp);
    seq.push(exp_.reduce());
  };

  // Allow the expression to seek forwards through the input for a match
  seq.push(star(dot(), false));

  // Create the root capturing expression
  pushExpression();

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
      pushExpression();
    } else if (chr === ')') {
      popExpression();
    } else if (chr === '|') {
      seq = exp.splitSequence();
    } else {
      seq.push(literal(chr));
    }
  }

  popExpression();

  return {
    // Bind `next` arguments. The final `next` value is the terminal state.
    matcher: exp.reduce()(term()),
    source: expression,
    flags,
    ignoreCase: flags.includes('i'),
    multiline: flags.includes('m'),
    dotAll: flags.includes('s'),
  };
};
