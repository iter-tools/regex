import { code } from './literals';
import {
  State,
  MatcherState,
  Context,
  W0Context,
  W1Context,
  Matcher,
  exprType,
  successType,
  contType,
} from './types';
import { Pattern, getPatternInternal } from '../pattern';

export type Captures = Array<string | undefined>;

const cloneMatcherState = (state: MatcherState) => {
  const { result, captureStack, repetitionStates } = state;
  return { result, captureStack, repetitionStates };
};

export class Node {
  worse: Node | null;

  constructor() {
    this.worse = null;
  }
}

export class Sequence extends Node {
  next: Matcher;
  mutableState: MatcherState;

  constructor(next: Matcher, mutableState: MatcherState) {
    super();
    this.next = next;
    this.mutableState = mutableState;
  }
}

// A match represents two closely related things:
//   - a pending match: the root expression of a continuing line of evaluation which may or may not succeed
//   - a successful match: a placeholder for results while better alternatives being evaluated
// When the global flag is enabled a single match may be both these things at the same time.
export class Match extends Node {
  pattern: Pattern;
  // Disambiguate between successive occurences of the pattern when matching globally
  globalIdx: number;
  captures: Captures | null;
  head: Node;

  constructor(pattern: Pattern, globalIdx: number, captures: Captures | null = null) {
    super();
    this.pattern = pattern;
    this.globalIdx = globalIdx;
    this.head = new Node();
    this.captures = captures;

    if (pattern.global || globalIdx === 0) {
      const { initialState, matcher } = getPatternInternal(pattern);

      this.head.worse = new Sequence(matcher, cloneMatcherState(initialState));
    }
  }
}

export class Engine {
  /* eslint-disable lines-between-class-members */
  global: boolean;
  root: Match;
  repetitionCount: number;
  index = 0;
  starved = true;
  context0: W0Context = {
    width: 0,
    lastChr: undefined!,
    lastCode: -1,
    nextChr: undefined!,
    nextCode: -1,
    seenRepetitions: [],
  };
  context1: W1Context = {
    width: 1,
    chr: undefined!,
    chrCode: -1,
  };
  context: Context = this.context0;
  match: Match;
  prevNode: Node = null!;
  node: Node | null = null;
  /* eslint-enable lines-between-class-members */

  constructor(pattern: Pattern) {
    this.global = pattern.global;
    this.repetitionCount = getPatternInternal(pattern).initialState.repetitionStates.length;

    this.root = new Match(pattern, 0);
    this.match = this.root;
  }

  get done() {
    return this.root.head.worse === null;
  }

  feed(chr: string | null) {
    const { context0: ctx0, context1: ctx1 } = this;

    ctx0.lastChr = ctx0.nextChr;
    ctx0.lastCode = ctx0.nextCode;
    ctx0.nextChr = chr;
    ctx0.nextCode = chr === null ? -1 : code(chr);
    ctx0.seenRepetitions = new Array(this.repetitionCount);

    if (ctx0.lastChr !== undefined) {
      this.starved = false;
    }

    if (ctx0.nextChr !== null) {
      ctx1.chr = ctx0.nextChr;
      ctx1.chrCode = ctx0.nextCode;
    }
  }

  startTraversal(match: Match) {
    const { head } = match;
    this.prevNode = head;
    this.node = head.worse;
    this.match = match;
  }

  fail() {
    if (!(this.node instanceof Sequence)) throw new Error();

    this.prevNode.worse = this.node = this.node.worse;
  }

  succeed(captures: Captures) {
    const { node, match } = this;
    if (!(node instanceof Sequence)) throw new Error();
    const { pattern, globalIdx } = match;

    // Stop matching any worse alternatives
    this.prevNode.worse = this.node = new Match(pattern, globalIdx + 1, captures);
  }

  explode(matchers: Array<Matcher>) {
    const { node } = this;
    if (!(node instanceof Sequence)) throw new Error();

    const { mutableState, worse } = node;

    let prev = this.prevNode;
    let seq: Sequence = undefined!;
    for (const matcher of matchers) {
      seq = new Sequence(matcher, cloneMatcherState(mutableState));
      prev.worse = seq;
      prev = seq;
    }

    seq.worse = worse;

    // continue from the first of the nodes we just inserted
    this.node = this.prevNode.worse;
  }

  apply(state: State | null) {
    if (!(this.node instanceof Sequence)) throw new Error();

    if (state === null) {
      this.fail();
    } else if (state.type === successType) {
      this.succeed(state.captures);
    } else if (state.type === exprType) {
      this.explode(state.seqs);
    } else if (state.type === contType) {
      this.node.next = state;
    } else {
      throw new Error(`Unexpected state of {type: '${(state as any).type}'}`);
    }
  }

  step0() {
    const context = this.context as W0Context;

    let { node } = this;
    while (node instanceof Sequence && node.next.width === 0) {
      this.apply(node.next.match(node.mutableState, context));
      ({ node } = this);
    }
    if (node instanceof Sequence && node.next.width === 1 && context.nextChr === null) {
      this.fail();
    }
  }

  step1() {
    const context = this.context as W1Context;
    if (this.node instanceof Sequence) {
      const { next, mutableState } = this.node;
      if (next.width === 1) {
        this.apply(next.match(mutableState, context));
      } else {
        throw new Error('w0 where w1 expected');
      }
    }
  }

  traverse(step: () => void) {
    this.startTraversal(this.root);

    while (true) {
      while (this.node !== null) {
        const { node } = this;
        step();
        if (node === this.node) {
          this.prevNode = this.node;
          this.node = this.node.worse;
        }
      }
      const last = this.prevNode;
      if (last instanceof Match && last.head.worse !== null) {
        this.startTraversal(last);
      } else {
        break;
      }
    }
  }

  traverse0() {
    const { starved } = this;

    if (starved) {
      throw new Error('step0 called without feeding new input');
    }

    this.context = this.context0;

    this.traverse(() => this.step0());

    const matches: Array<Captures> = [];

    let match = this.root;
    while (true) {
      if (match.captures !== null) {
        matches.push(match.captures);
        match.captures = null;
      }
      if (match.head.worse instanceof Match) {
        match = match.head.worse;
      } else {
        break;
      }
    }
    this.root = match;

    return matches;
  }

  traverse1() {
    this.context = this.context1;

    this.traverse(() => this.step1());

    this.starved = true;
  }
}
