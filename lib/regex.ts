import emptyStack from '@iter-tools/imm-stack';
import type {
  Matcher,
  Result,
  MatchState,
  UnboundMatcher,
  Width0Matcher,
  Flags,
  RepetitionState,
  PatternLike,
} from './types';
import { flattenCapture } from './captures';
import { getCharSetDesc, Parser, Visit, visit, Visitors, isAnchored } from './ast';
import { Alternative } from 'regexpp/ast';
import { getTester, testNotNewline, testWord } from './literals';
import { createTree } from './rbt';
import { asPattern, Pattern } from './pattern';

const identity: UnboundMatcher = (next) => next;

const compose = (lExp: UnboundMatcher, rExp: UnboundMatcher) => {
  return (next: Matcher) => lExp(rExp(next));
};

const growResult = (state: MatchState, chr: string) => {
  state.result += chr;
};

const term = (global: boolean, capturesLen: number): Matcher => ({
  width: 0,
  desc: 'term',
  match: (state: MatchState) => {
    const { captureList } = state;
    const rootCapture = captureList.value;
    return rootCapture.result !== null
      ? {
          type: 'success',
          global,
          captures: flattenCapture(rootCapture, capturesLen),
        }
      : null;
  },
});

const unmatched = (): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };

  return {
    width: 1,
    desc: 'unmatched',
    match: () => cont,
  };
};

// match a character
const literal = (desc: string, test: (chr: number) => boolean, negate = false): UnboundMatcher => (
  next,
) => {
  const cont: Result = { type: 'cont', next };
  return {
    width: 1,
    desc,
    match: (state, chr, chrCode) => {
      if (negate !== test(chrCode)) {
        growResult(state, chr);
        return cont;
      } else {
        return null;
      }
    },
  };
};

const expression = (seqs: Array<UnboundMatcher>): UnboundMatcher => (next) => {
  const result: Result = {
    type: 'expr',
    expr: seqs.map((seq) => ({
      type: 'cont',
      next: seq(next),
    })),
  };

  return {
    width: 0,
    desc: 'expression',
    match: () => result,
  };
};

const resetRepetitionStates = (
  idxs: Array<number>,
  initialRepetitionStates: Array<RepetitionState>,
): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };

  return {
    desc: 'reset reptition state',
    width: 0,
    match: (state) => {
      let { repetitionStates } = state;
      for (const idx of idxs) {
        repetitionStates = repetitionStates.find(idx).update(initialRepetitionStates[idx]);
      }

      state.repetitionStates = repetitionStates;

      return cont;
    },
  };
};

const edgeAssertion = (kind: 'start' | 'end', flags: Flags): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };
  return {
    desc: `assertion: at ${kind}`,
    width: 0,
    match: flags.multiline
      ? (state, context) => {
          const { atStart, atEnd, lastCode, nextCode } = context;
          return kind === 'start'
            ? atStart || !testNotNewline(lastCode!)
              ? cont
              : null
            : atEnd || !testNotNewline(nextCode!)
            ? cont
            : null;
        }
      : (state, context) => {
          const { atStart, atEnd } = context;
          return kind === 'start' ? (atStart ? cont : null) : atEnd ? cont : null;
        },
  };
};

const boundaryAssertion = (): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };
  return {
    desc: 'assertion: word boundary',
    width: 0,
    match: (state, context) => {
      const { atStart, atEnd, lastCode, nextCode } = context;
      const lastIsWord = atStart ? false : testWord(lastCode!);
      const nextIsWord = atEnd ? false : testWord(nextCode!);
      return lastIsWord !== nextIsWord ? cont : null;
    },
  };
};

const repeat = (exp: UnboundMatcher, key: number, greedy = true): UnboundMatcher => (next) => {
  // eslint-disable-next-line prefer-const
  let repeatCont: Result;
  // eslint-disable-next-line prefer-const
  let exprCont: Result;
  const doneCont: Result = { type: 'cont', next };

  const matcher: Width0Matcher = {
    desc: 'repeat',
    width: 0,
    match: (state, context): Result | null => {
      const repStateNode = state.repetitionStates.find(key);
      const { min, max } = repStateNode.value;

      if (context.seenRepetitions[key]) {
        return null;
      } else if (max === 0) {
        return doneCont;
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
  };

  repeatCont = { type: 'cont', next: exp(matcher) };
  exprCont = {
    type: 'expr',
    expr: greedy ? [repeatCont, doneCont] : [doneCont, repeatCont],
  };

  return matcher;
};

const startCapture = (idx: number): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };

  return {
    width: 0,
    desc: 'startCapture',
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

      return cont;
    },
  };
};

const endCapture = (): UnboundMatcher => (next) => {
  const cont: Result = { type: 'cont', next };

  return {
    width: 0,
    desc: 'endCapture',
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

      return cont;
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

    return expression([
      compose(
        !state.flags.multiline && isAnchored(node)
          ? identity
          : // Allow the expression to seek forwards through the input for a match
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

    state.initialRepetitionStates[qIdx] = { min, max };
    return repeat(visit(element), qIdx, greedy);
  },
};

export const parse = (pattern: PatternLike | string, flags?: string | undefined): Pattern => {
  let source;
  let _flags;

  if (pattern instanceof Pattern) {
    return pattern;
  } else if (typeof pattern === 'string') {
    source = pattern;
    _flags = flags || '';
  } else {
    ({ source } = pattern);
    _flags = flags !== undefined ? flags : pattern.flags || '';
  }

  const pState: ParserState = {
    cIdx: -1, // capture index
    qIdx: -1, // quantifier index
    flags: {
      global: _flags.includes('g'),
      ignoreCase: _flags.includes('i'),
      multiline: _flags.includes('m'),
      dotAll: _flags.includes('s'),
      unicode: _flags.includes('u'),
    },
    qIdxs: [],
    initialRepetitionStates: [],
  };

  if (pState.flags.unicode) {
    throw new Error('Regex u flag is unsupported');
  }

  const parser = new Parser();
  parser.parseFlags(_flags); // for validation
  const ast = parser.parsePattern(source);
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

  return asPattern({
    matcher,
    initialState,
    source,
    flags: _flags,
    ...pState.flags,
  });
};
