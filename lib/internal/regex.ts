import emptyStack from '@iter-tools/imm-stack';
import { Alternative, Pattern as RegexppPattern } from 'regexpp/ast';
import type { Flags } from '../types';
import {
  Matcher,
  State,
  MatcherState,
  FailureState,
  UnboundMatcher,
  Width0Matcher,
  W0Context,
  RepetitionState,
  exprType,
  successType,
  contType,
  failureType,
} from './types';
import { flattenCapture } from './captures';
import { getCharSetDesc, Visit, visit, Visitors, isAnchored } from './ast';
import { getTester, testNotNewline, testWord } from './literals';
import { createTree } from './rbt';

const fail: FailureState = {
  type: failureType,
};

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
  next: null!,
  match(state: MatcherState) {
    const { global, capturesLen } = this.props;
    const { captureStack } = state;

    const rootCapture = captureStack.peek().peek();

    return {
      type: successType,
      global,
      captures: flattenCapture(rootCapture, capturesLen),
    };
  },
  props: { global, capturesLen },
});

const unmatched = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    width: 1,
    name: 'unmatched',
    next,
    match() {
      return this.next;
    },
    props: {},
  };
};

// match a character
const literal =
  (value: string, test: (chrCode: number) => boolean, negate = false): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      width: 1,
      name: 'literal',
      next,
      match(state, { chr, chrCode }) {
        const { test, negate } = this.props;
        if (negate !== test(chrCode)) {
          growResult(state, chr);
          return this.next;
        } else {
          return fail;
        }
      },
      props: { value, test, negate },
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
      match() {
        return this.props.result;
      },
      props: { matchers: boundMatchers, result },
    };
  };

const resetRepetitionStates =
  (idxs: Array<number>, initialRepetitionStates: Array<RepetitionState>): UnboundMatcher =>
  (next) => {
    return {
      type: contType,
      width: 0,
      name: 'resetRepetitionStates',
      next,
      match(state) {
        const { idxs, initialRepetitionStates } = this.props;
        let { repetitionStates } = state;
        for (const idx of idxs) {
          repetitionStates = repetitionStates.find(idx).update(initialRepetitionStates[idx]);
        }

        state.repetitionStates = repetitionStates;

        return this.next;
      },
      props: { idxs, initialRepetitionStates },
    };
  };

const edgeAssertion =
  (kind: 'start' | 'end', flags: Flags): UnboundMatcher =>
  (next) => {
    const match: (state: MatcherState, context: W0Context) => State = flags.multiline
      ? kind === 'start'
        ? function match(this: any, state, context) {
            const { lastCode } = context;
            return lastCode === -1 || !testNotNewline(lastCode) ? this.next : fail;
          }
        : function match(this: any, state, context) {
            const { nextCode } = context;
            return nextCode === -1 || !testNotNewline(nextCode) ? this.next : fail;
          }
      : kind === 'start'
      ? function match(this: any, state, context) {
          const { lastCode } = context;
          return lastCode === -1 ? this.next : fail;
        }
      : function match(this: any, state, context) {
          const { nextCode } = context;
          return nextCode === -1 ? this.next : fail;
        };

    return {
      type: contType,
      width: 0,
      name: 'edgeAssertion',
      next,
      match,
      props: { kind },
    };
  };

const boundaryAssertion = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    width: 0,
    name: 'boundaryAssertion',
    next,
    match(state, context) {
      const { lastCode, nextCode } = context;
      const lastIsWord = lastCode === -1 ? false : testWord(lastCode);
      const nextIsWord = nextCode === -1 ? false : testWord(nextCode);
      return lastIsWord !== nextIsWord ? this.next : fail;
    },
    props: {},
  };
};

const repeat =
  (exp: UnboundMatcher, key: number, greedy = true): UnboundMatcher =>
  (next) => {
    const matcher: Width0Matcher = {
      type: contType,
      width: 0,
      name: 'repeat',
      next,
      match(state, context): State {
        const { repeatCont, exprCont, key } = this.props;
        const repStateNode = state.repetitionStates.find(key);
        const { min, max } = repStateNode.value;

        if (context.seenRepetitions[key]) {
          return fail;
        } else if (max === 0) {
          return this.next;
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
      props: { key, greedy },
    };

    const repeatCont = exp(matcher);
    const exprCont: State = {
      type: exprType,
      seqs: greedy ? [repeatCont, next] : [next, repeatCont],
    };

    matcher.props.repeatCont = repeatCont;
    matcher.props.exprCont = exprCont;

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
      match(state) {
        const { idx } = this.props;
        const { result, captureStack } = state;
        const captureList = captureStack.peek();

        const partialCapture = {
          idx,
          start: result === null ? 0 : result.length,
          end: null,
          result: null,
          children: emptyStack,
        };

        state.captureStack = captureStack
          .replace(captureList.push(partialCapture))
          .push(emptyStack);
        state.result = result === null ? '' : result;

        return this.next;
      },
      props: { idx },
    };
  };

const endCapture = (): UnboundMatcher => (next) => {
  return {
    type: contType,
    width: 0,
    name: 'endCapture',
    next,
    match(state) {
      const { result } = state;
      let { captureStack } = state;
      const children = captureStack.peek();

      state.captureStack = captureStack = state.captureStack.pop();

      let captureList = captureStack.peek();
      const partialCapture = captureList.peek();
      const { idx, start } = partialCapture;
      const end = result!.length;

      captureList = captureList.pop();

      const capture = {
        idx,
        start,
        end,
        result: result!.slice(start!, end),
        children,
      };

      if (captureList.size > 0 && captureList.peek().idx === capture.idx) {
        // Subsequent matches of the same capture group overwrite
        captureList = captureList.prev;
      }

      captureList = captureList.push(capture);

      state.result = captureStack.size === 1 ? null : result;
      state.captureStack = captureStack.replace(captureList);

      return this.next;
    },
    props: {},
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

  const initialState: MatcherState = {
    result: null,
    captureStack: emptyStack.push(emptyStack),
    repetitionStates: pState.initialRepetitionStates.reduce(
      (tree, state, i) => tree.insert(i, state),
      createTree<number, RepetitionState>((a, b) => a - b),
    ),
  };

  // Bind `next` arguments. The final `next` value is the terminal state.
  const matcher = seq(term(pState.flags.global, pState.cIdx + 1)) as Width0Matcher;

  return { initialState, matcher };
};
