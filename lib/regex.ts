import emptyStack from '@iter-tools/imm-stack';
import {
  Matcher,
  Pattern,
  Result,
  MatchState,
  UnboundMatcher,
  ExpressionResult,
  Width0Matcher,
  Flags,
  RepetitionState,
} from './types';
import { flattenCapture } from './captures';
import { getCharSetDesc, Parser, Visit, visit, Visitors } from './ast';
import { Alternative } from 'regexpp/ast';
import { code, getTester } from './literals';
import { createTree } from './rbt';

const when = (condition: boolean, value: Result) => {
  return condition ? value : null;
};

const identity: UnboundMatcher = (next) => next;

const compose = (lExp: UnboundMatcher, rExp: UnboundMatcher) => {
  return (next: Matcher) => lExp(rExp(next));
};

const growResult = (state: MatchState, chr: string): MatchState => {
  const { result, captures, repetitionStates } = state;
  return captures.stack.size === 0 && result === null
    ? state
    : {
        result: result + chr,
        captures,
        repetitionStates,
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

const expression = (seqs: Array<UnboundMatcher>): UnboundMatcher => (next) => {
  const seqMatchers = seqs.map((seq) => seq(next));
  return {
    width: 0,
    desc: 'expression',
    match: (state) => {
      return seqMatchers.length
        ? {
            type: 'expr',
            expr: seqMatchers.map((next) => ({
              type: 'cont',
              next,
              state,
            })),
          }
        : {
            type: 'cont',
            next,
            state,
          };
    },
  };
};

const resetRepetitionStates = (
  idxs: Array<number>,
  initialRepetitionStates: Array<RepetitionState>,
): UnboundMatcher => (next) => ({
  desc: 'reset reptition state',
  width: 0,
  match: (state) => {
    let { repetitionStates } = state;
    for (const idx of idxs) {
      repetitionStates = repetitionStates.find(idx).update(initialRepetitionStates[idx]);
    }

    return {
      type: 'cont',
      next,
      state: {
        ...state,
        repetitionStates,
      },
    };
  },
});

const repeat = (exp: UnboundMatcher, key: number, greedy = true): UnboundMatcher => {
  return (next) => {
    let expMatcher: Matcher;

    const matcher: Width0Matcher = {
      desc: 'repeat',
      width: 0 as const,
      match: (state, context): Result | null => {
        const repState = state.repetitionStates.get(key);
        const { min, max, context: prevContext } = repState;

        if (context === prevContext) {
          return null;
        } else if (max === 0) {
          return {
            type: 'cont',
            next,
            state,
          };
        } else {
          const nextRepState = {
            min: min === 0 ? 0 : min - 1,
            max: max === 0 ? 0 : max - 1,
            context,
          };
          const { result, captures } = state;
          const nextState = {
            result,
            captures,
            // For tree of size n we only update lg(N) nodes
            repetitionStates: state.repetitionStates.find(key).update(nextRepState),
          };

          if (min > 0) {
            return {
              type: 'cont',
              next: expMatcher,
              state: nextState,
            };
          } else {
            const matchers = greedy ? [expMatcher, next] : [next, expMatcher];
            return {
              type: 'expr',
              expr: matchers.map((next) => ({
                type: 'cont',
                next,
                state: nextState,
              })),
            };
          }
        }
      },
    };

    expMatcher = exp(matcher);

    return matcher;
  };
};

const startCapture = (idx: number): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'startCapture',
  match: (state) => {
    const { result, captures, repetitionStates } = state;
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
        result: result === null ? '' : result,
        captures: { stack, list },
        repetitionStates,
      },
    };
  },
});

const endCapture = (): UnboundMatcher => (next) => ({
  width: 0,
  desc: 'endCapture',
  match: (state) => {
    const { result, captures, repetitionStates } = state;
    const { stack, list: children } = captures;
    const { start, parentList, idx } = stack.value;
    const end = result!.length;

    const capture = {
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
        result,
        captures: {
          stack: stack.prev,
          list: list.push(capture),
        },
        repetitionStates,
      },
    };
  },
});

const capture = (idx: number, exp: UnboundMatcher) => {
  return compose(startCapture(idx), compose(exp, endCapture()));
};

type ParserState = {
  flags: Flags;
  qIdxs: Array<number>;
  qIdx: number;
  cIdx: number;
  initialRepetitionStates: Array<RepetitionState>;
};

const visitExpression = (
  alternatives: Array<Alternative>,
  state: ParserState,
  visit: Visit<UnboundMatcher>,
) => {
  let result: UnboundMatcher;

  const qIdxs = (state.qIdxs = []);

  // prettier-ignore
  switch (alternatives.length) {
      case 0: result = identity; break;
      case 1: result = visit(alternatives[0]); break;
      default: result = expression(alternatives.map(visit)); break;
    }

  return compose(resetRepetitionStates(qIdxs, state.initialRepetitionStates), result);
};

const visitors: Visitors<UnboundMatcher, ParserState> = {
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

  Alternative: (node, state, visit) => {
    return node.elements.map(visit).reduce(compose, identity);
  },

  CapturingGroup: (node, state, visit) => {
    if (typeof node.name === 'string') {
      throw new Error('Regex named capturing groups not implemented');
    }
    return capture(++state.cIdx, visitExpression(node.alternatives, state, visit));
  },

  Pattern: (node, state, visit) => {
    const qIdx = ++state.qIdx;
    state.initialRepetitionStates[qIdx] = { min: 0, max: Infinity, context: undefined! };
    return expression([
      compose(
        // Allow the expression to seek forwards through the input for a match
        // identity,
        repeat(unmatched(), qIdx, false),
        // Evaluate pattern capturing to group 0
        capture(++state.cIdx, visitExpression(node.alternatives, state, visit)),
      ),
    ]);
  },

  Character: (node) => {
    return literal(String.fromCharCode(node.value), (c) => c === node.value);
  },

  CharacterClass: (node, state) => {
    const tester = getTester(node, state.flags);
    return literal('character class', tester, node.negate);
  },

  CharacterSet: (node, state) => {
    const tester = getTester(node, state.flags);
    const desc = getCharSetDesc(node);
    if (node.kind === 'any') {
      // I need to push negate back into the testers?
      return literal(desc, tester);
    } else {
      return literal(node.negate ? desc.toUpperCase() : desc, tester, node.negate);
    }
  },

  Quantifier: (node, state, visit) => {
    const { element, min, max, greedy } = node;
    // See https://github.com/mysticatea/regexpp/issues/21
    if (min > max) {
      throw new Error('numbers out of order in {} quantifier');
    }
    const qIdx = ++state.qIdx;
    state.qIdxs.push(qIdx);

    state.initialRepetitionStates[qIdx] = { min, max, context: undefined! };
    return repeat(visit(element), qIdx, greedy);
  },
};

export const parse = (source: string, flags = ''): Pattern => {
  const pState: ParserState = {
    cIdx: -1, // capture index
    qIdx: -1, // quantifier index
    flags: {
      global: flags.includes('g'),
      ignoreCase: flags.includes('i'),
      multiline: flags.includes('m'),
      dotAll: flags.includes('s'),
      unicode: flags.includes('u'),
    },
    qIdxs: [],
    initialRepetitionStates: [],
  };

  if (pState.flags.unicode) {
    throw new Error('Regex u flag is unsupported');
  }

  const parser = new Parser();
  parser.parseFlags(flags); // for validation
  const ast = parser.parsePattern(source);
  const seq = visit(ast, pState, visitors);

  const state = {
    result: null,
    captures: {
      stack: emptyStack,
      list: emptyStack,
    },
    repetitionStates: pState.initialRepetitionStates.reduce(
      (tree, state, i) => tree.insert(i, state),
      createTree<number, RepetitionState>((a, b) => a - b),
    ),
  };

  // Bind `next` arguments. The final `next` value is the terminal state.
  const matcher = seq(
    term(() => (pState.flags.global ? result : null), pState.cIdx + 1),
  ) as Width0Matcher;

  // TODO is this line in the wrong place?
  const result = matcher.match(state, {}) as ExpressionResult;

  return {
    expr: result,
    source,
    flags,
    ...pState.flags,
  };
};
