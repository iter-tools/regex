import emptyStack from '@iter-tools/imm-stack';
import { Matcher, Pattern, Result, MatchState, UnboundMatcher, ExpressionResult } from './types';
import { flattenCapture } from './captures';
import { literalNames, Parser, Visit, visit, Visitors } from './ast';
import { Alternative } from 'regexpp/ast';
import { code, testers } from './literals';

const when = (condition: boolean, value: Result) => {
  return condition ? value : null;
};

const identity: UnboundMatcher = (next) => next;

const compose = (lExp: UnboundMatcher, rExp: UnboundMatcher) => {
  return (next: Matcher) => lExp(rExp(next));
};

const growResult = (state: MatchState, chr: string): MatchState => {
  const { result, captures } = state;
  return captures.stack.size === 0 && result === null
    ? state
    : {
        ...state,
        result: result + chr,
      };
};

const term = (getExpr: () => ExpressionResult | null, capturesLen: number): Matcher => ({
  width: 0,
  desc: 'term',
  match: (state: MatchState) => {
    const { result, captures } = state;
    return result !== null
      ? {
          type: 'success',
          expr: getExpr(),
          captures: flattenCapture(captures.list.value, capturesLen),
        }
      : null;
  },
});

const unmatched = (): UnboundMatcher => (next: Matcher) => ({
  width: 1,
  desc: 'unmatched',
  match: (state) => ({ type: 'cont', next, state }),
});

// match a character
const literal = (desc: string, test: (chr: number) => boolean, negate = false): UnboundMatcher => (
  next,
) => ({
  width: 1,
  desc,
  match: (state, chr: string) => {
    return when(negate !== test(code(chr)), {
      type: 'cont',
      next,
      state: growResult(state, chr),
    });
  },
});

const expression = (seqs: Array<UnboundMatcher>): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'expression',
  match: (state) => {
    return seqs.length
      ? {
          type: 'expr',
          expr: seqs.map((seq) => ({
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

const repeat = (exp: UnboundMatcher, greedy = true, min = 0, max = Infinity): UnboundMatcher => (
  next,
) => ({
  desc: 'repeat',
  width: 0 as const,
  match: (state): Result => {
    if (max === 0) {
      return {
        type: 'cont',
        next,
        state,
      };
    } else {
      const nextMin = Math.max(0, min - 1);
      const nextMax = Math.max(0, max - 1);
      const recMatcher = exp(repeat(exp, greedy, nextMin, nextMax)(next));
      if (min > 0) {
        return {
          type: 'cont',
          next: recMatcher,
          state,
        };
      } else {
        const matchers = greedy ? [recMatcher, next] : [next, recMatcher];
        return {
          type: 'expr',
          expr: matchers.map((next) => ({ type: 'cont', next, state })),
        };
      }
    }
  },
});

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
    const { start, parentList, idx } = stack.value;
    const end = result!.length;

    const capture = {
      ...stack.value,
      idx,
      start: result === null ? 0 : result.length,
      end,
      result: result!.slice(start!, end),
      parentList,
      children,
    };

    let list = parentList;

    if (list.size && list.value.idx === capture.idx) {
      // Subsequent matches of the same capture group overwrite
      list = list.prev;
    }

    return {
      type: 'cont',
      next,
      state: {
        ...state,
        result,
        captures: {
          stack: stack.prev,
          list: list.push(capture),
        },
      },
    };
  },
});

const capture = (idx: number, exp: UnboundMatcher) => {
  return compose(startCapture(idx), compose(exp, endCapture()));
};

export const parse = (source: string, flags = ''): Pattern => {
  const global = flags.includes('g');
  const ignoreCase = flags.includes('i');
  const multiline = flags.includes('m');
  const dotAll = flags.includes('s');

  let idx = -1;

  const visitExpression = (alternatives: Array<Alternative>, visit: Visit<UnboundMatcher>) => {
    // prettier-ignore
    switch (alternatives.length) {
      case 0: return identity;
      case 1: return visit(alternatives[0]);
      default: return expression(alternatives.map(visit));
    }
  };

  const visitors: Visitors<UnboundMatcher> = {
    Backreference: () => {
      throw new Error('Regex backreferences not implemented');
    },
    Assertion: (node) => {
      if (node.kind === 'lookahead') {
        throw new Error('Regex lookahead not implemented');
      } else if (node.kind === 'lookbehind') {
        throw new Error('Regex lookbehind unsupported');
      } else if (node.kind === 'word') {
        throw new Error('Regex word boundary assertions not implemented');
      } else {
        throw new Error('Regex edge assertions not implemented');
      }
    },
    Alternative: (node, visit) => {
      return node.elements.map(visit).reduce(compose, identity);
    },
    CapturingGroup: (node, visit) => {
      if (typeof node.name === 'string') {
        throw new Error('Regex named capturing groups not implemented');
      }
      return capture(++idx, visitExpression(node.alternatives, visit));
    },
    Pattern: (node, visit) => {
      return expression([
        compose(
          // Allow the expression to seek forwards through the input for a match
          // identity,
          repeat(unmatched(), false),
          // Evaluate pattern capturing to group 0
          capture(++idx, visitExpression(node.alternatives, visit)),
        ),
      ]);
    },
    Character: (node) => {
      return literal(String.fromCharCode(node.value), (c) => c === node.value);
    },
    CharacterClass: (node) => {
      throw new Error('WIP');
    },
    CharacterSet: (node) => {
      if (node.kind === 'any') {
        return dotAll ? literal('.', testers.any) : literal('.', testers.newline, true);
      } else if (node.kind === 'property') {
        throw new Error('Regex unicode property escapes unsupported');
      } else {
        const desc = literalNames[node.kind];
        return literal(node.negate ? desc.toUpperCase() : desc, testers[node.kind], node.negate);
      }
    },
    Quantifier: (node, visit) => {
      return repeat(visit(node.element), node.greedy, node.min, node.max);
    },
  };

  const parser = new Parser();
  parser.parseFlags(flags); // for validation
  const ast = parser.parsePattern(source);
  const seq = visit(ast, visitors);

  const matcher = seq(term(() => (global ? result : null), idx + 1));
  const result = matcher.match({
    result: null,
    captures: {
      stack: emptyStack,
      list: emptyStack,
    },
  }) as ExpressionResult;

  return {
    // Bind `next` arguments. The final `next` value is the terminal state.
    expr: result,
    source,
    flags,
    global,
    ignoreCase,
    multiline,
    dotAll,
  };
};
