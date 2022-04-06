import emptyStack from '@iter-tools/imm-stack';
import { Alternative, Pattern as RegexppPattern } from 'regexpp/ast';
import type { Flags } from '../types';
import {
  Matcher,
  State,
  MatcherState,
  UnboundMatcher,
  Width0Matcher,
  RepetitionState,
  exprType,
  successType,
  contType,
} from './types';
import { flattenCapture } from './captures';
import { getCharSetDesc, Visit, visit, Visitors, isAnchored } from './ast';
import { getTester, testNotNewline, testWord } from './literals';
import { createTree } from './rbt';

const identity: UnboundMatcher = (next) => next;

const compose = (lExp: UnboundMatcher, rExp: UnboundMatcher) => {
  return (next: Matcher) => lExp(rExp(next));
};

const growResult = (state: MatcherState, chr: string) => {
  state.result += chr;
};

const term = (global: boolean, capturesLen: number): Matcher => ({
  type: contType,
  width: 0,
  name: 'term',
  next: null,
  match: (state: MatcherState) => {
    const { captureList } = state;
    const rootCapture = captureList.value;
    return rootCapture.result !== null
      ? {
          type: successType,
          global,
          captures: flattenCapture(rootCapture, capturesLen),
        }
      : null;
  },
});

const unmatched = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    width: 1,
    name: 'unmatched',
    next,
    match: () => next,
  };
};

// match a character
const literal =
  (value: string, test: (chr: number) => boolean, negate = false): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      width: 1,
      name: 'literal',
      next,
      match: (state, chr, chrCode) => {
        if (negate !== test(chrCode)) {
          growResult(state, chr);
          return next;
        } else {
          return null;
        }
      },
      value,
    };
  };

const expression =
  (matchers: Array<UnboundMatcher>): UnboundMatcher =>
  (next) => {
    const boundMatchers = matchers.map((matcher) => matcher(next));
    const result: State = { type: exprType, seqs: boundMatchers };

    return {
      type: contType,
      width: 0,
      name: 'expression',
      next,
      match: () => result,
      matchers: boundMatchers,
    };
  };

const resetRepetitionStates =
  (idxs: Array<number>, initialRepetitionStates: Array<RepetitionState>): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      name: 'resetRepetitionStates',
      width: 0,
      next,
      match: (state) => {
        let { repetitionStates } = state;
        for (const idx of idxs) {
          repetitionStates = repetitionStates.find(idx).update(initialRepetitionStates[idx]);
        }

        state.repetitionStates = repetitionStates;

        return next;
      },
    };
  };

const edgeAssertion =
  (kind: 'start' | 'end', flags: Flags): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      name: 'edgeAssertion',
      width: 0,
      next,
      match: flags.multiline
        ? kind === 'start'
          ? (state, context) => {
              const { lastCode } = context;
              return lastCode === null || !testNotNewline(lastCode) ? next : null;
            }
          : (state, context) => {
              const { nextCode } = context;
              return nextCode === null || !testNotNewline(nextCode) ? next : null;
            }
        : kind === 'start'
        ? (state, context) => {
            const { lastCode } = context;
            return lastCode === null ? next : null;
          }
        : (state, context) => {
            const { nextCode } = context;
            return nextCode === null ? next : null;
          },
      kind,
    };
  };

const boundaryAssertion = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    name: 'boundaryAssertion',
    width: 0,
    next,
    match: (state, context) => {
      const { lastCode, nextCode } = context;
      const lastIsWord = lastCode === null ? false : testWord(lastCode);
      const nextIsWord = nextCode === null ? false : testWord(nextCode);
      return lastIsWord !== nextIsWord ? next : null;
    },
  };
};

const repeat =
  (exp: UnboundMatcher, key: number, greedy = true): UnboundMatcher =>
  (next) => {
    const matcher = {
      type: contType,
      name: 'repeat',
      width: 0,
      next,
      match: (state, context): State | null => {
        const repStateNode = state.repetitionStates.find(key);
        const { min, max } = repStateNode.value;

        if (context.seenRepetitions[key]) {
          return null;
        } else if (max === 0) {
          return next;
        } else {
          context.seenRepetitions[key] = true;
          const nextRepState = {
            min: min === 0 ? 0 : min - 1,
            max: max === 0 ? 0 : max - 1,
            context,
          };
          state.repetitionStates = repStateNode.update(nextRepState);

          return min > 0 ? repeatCont : exprCont;
        }
      },
    } as Width0Matcher & { repeatCont: State; exprCont: State };

    const repeatCont = exp(matcher);
    const exprCont: State = {
      type: exprType,
      seqs: greedy ? [repeatCont, next] : [next, repeatCont],
    };

    matcher.repeatCont = repeatCont;
    matcher.exprCont = exprCont;

    return matcher;
  };

const startCapture =
  (idx: number): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      width: 0,
      name: 'startCapture',
      next,
      match: (state) => {
        const { result, captureStack, captureList: parentList } = state;

        const list = emptyStack;

        const capture = {
          idx,
          start: result === null ? 0 : result.length,
          end: null,
          result: null,
          parentList,
          children: list,
        };

        state.result = result === null ? '' : result;
        state.captureStack = captureStack.push(capture);
        state.captureList = list;

        return next;
      },
      idx,
    };
  };

const endCapture = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    width: 0,
    name: 'endCapture',
    next,
    match: (state) => {
      const { result, captureStack, captureList: children } = state;
      const { start, parentList, idx } = captureStack.value;
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

      if (list.size > 0 && list.value.idx === capture.idx) {
        // Subsequent matches of the same capture group overwrite
        list = list.prev;
      }

      if (captureStack.prev.size === 0) state.result = null;
      state.captureStack = captureStack.prev;
      state.captureList = list.push(capture);

      return next;
    },
  };
};

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
  const qIdxs = (state.qIdxs = []);

  const reset = resetRepetitionStates(qIdxs, state.initialRepetitionStates);

  // prettier-ignore
  switch (alternatives.length) {
    case 0: return identity;
    case 1: return compose(reset, visit(alternatives[0]));
    default: return expression(alternatives.map(alt => compose(reset, visit(alt))));
  }
};

const visitors: Visitors<UnboundMatcher, ParserState> = {
  Backreference: () => {
    throw new Error('Regex backreferences not implemented');
  },

  Assertion: (node, state) => {
    if (node.kind === 'lookahead') {
      throw new Error('Regex lookahead not implemented');
    } else if (node.kind === 'lookbehind') {
      throw new Error('Regex lookbehind unsupported');
    } else if (node.kind === 'word') {
      return boundaryAssertion();
    } else {
      return edgeAssertion(node.kind, state.flags);
    }
  },

  Alternative: (node, state, visit) => {
    return node.elements.map(visit).reduce(compose, identity);
  },

  Group: (node, state, visit) => {
    return visitExpression(node.alternatives, state, visit);
  },

  CapturingGroup: (node, state, visit) => {
    if (typeof node.name === 'string') {
      throw new Error('Regex named capturing groups not implemented');
    }
    return capture(++state.cIdx, visitExpression(node.alternatives, state, visit));
  },

  Pattern: (node, state, visit) => {
    const qIdx = ++state.qIdx;
    state.initialRepetitionStates[qIdx] = { min: 0, max: Infinity };

    return compose(
      state.flags.sticky || (!state.flags.multiline && isAnchored(node))
        ? identity
        : // Allow the expression to seek forwards through the input for a match
          repeat(unmatched(), qIdx, false),
      // Evaluate pattern capturing to group 0
      capture(++state.cIdx, visitExpression(node.alternatives, state, visit)),
    );
  },

  Character: (node) => {
    return literal(node.raw, (c) => c === node.value);
  },

  CharacterClass: (node, state) => {
    const tester = getTester(node, state.flags);

    return literal(node.raw, tester, node.negate);
  },

  CharacterSet: (node, state) => {
    const tester = getTester(node, state.flags);
    const name = getCharSetDesc(node);
    if (node.kind === 'any') {
      // I need to push negate back into the testers?
      return literal(name, tester);
    } else {
      return literal(node.negate ? name.toUpperCase() : name, tester, node.negate);
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

    state.initialRepetitionStates[qIdx] = { min, max };
    return repeat(visit(element), qIdx, greedy);
  },
};

export const buildPatternInternal = (ast: RegexppPattern, flags: Flags) => {
  const pState: ParserState = {
    cIdx: -1, // capture index
    qIdx: -1, // quantifier index
    flags,
    qIdxs: [],
    initialRepetitionStates: [],
  };

  if (pState.flags.unicode) {
    throw new Error('Regex u flag is unsupported');
  }

  const seq = visit(ast, pState, visitors);

  const initialState = {
    result: null,
    captureStack: emptyStack,
    captureList: emptyStack,
    repetitionStates: pState.initialRepetitionStates.reduce(
      (tree, state, i) => tree.insert(i, state),
      createTree<number, RepetitionState>((a, b) => a - b),
    ),
  };

  // Bind `next` arguments. The final `next` value is the terminal state.
  const matcher = seq(term(pState.flags.global, pState.cIdx + 1)) as Width0Matcher;

  return { initialState, matcher };
};
