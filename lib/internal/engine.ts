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
  failureType,
} from './types';
import { Pattern, getPatternInternal } from '../pattern';

export type Captures = Array<string | undefined>;

const cloneMatcherState = (state: MatcherState) => {
  const { result, captureStack, repetitionStates } = state;
  return { result, captureStack, repetitionStates };
};

export class Node {
  // We avoid having to deal with null pointers by instead dealing with seq, match, and failure
  worse: Node;
  data: Sequence | Match | Failure;

  constructor(data: Sequence | Match | Failure = null!) {
    this.worse = null!;
    this.data = data;
  }
}

export class Sequence {
  next: Matcher;
  mutableState: MatcherState;

  constructor(next: Matcher, mutableState: MatcherState) {
    this.next = next;
    this.mutableState = mutableState;
  }
}

// A match represents two closely related things:
//   - a pending match: the root expression of a continuing line of evaluation which may or may not succeed
//   - a successful match: a placeholder for results while better alternatives being evaluated
// When the global flag is enabled a single match may be both these things at the same time.
export class Match {
  pattern: Pattern;
  // Disambiguate between successive occurences of the pattern when matching globally
  globalIdx: number;
  captures: Captures | null;
  head: Node | null;

  constructor(pattern: Pattern, globalIdx: number, captures: Captures | null = null) {

    this.pattern = pattern;
    this.globalIdx = globalIdx;
    // Ensures prevNode is always defined so we can replace using `prevNode.worse = ...`
    this.head = null;
    this.captures = captures;

    if (pattern.global || globalIdx === 0) {
      const head = new Node();
      const fail = new Node(new Failure());

      head.worse = fail;

      const { initialState, matcher } = getPatternInternal(pattern);

      const seq = new Node(new Sequence(matcher, cloneMatcherState(initialState)));
      seq.worse = fail;
      head.worse = seq;

      this.head = head;
    }
  }
}

export class Failure {}

const isSequence = (r: Record<string, any>): r is Sequence => r.constructor === Sequence;
const isMatch = (r: Record<string, any>): r is Match => r.constructor === Match;
const isFailure = (r: Record<string, any>): r is Failure => r.constructor === Failure;

const context0Initial: W0Context = {
  width: 0,
  lastChr: undefined!,
  lastCode: -1,
  nextChr: undefined!,
  nextCode: -1,
  seenRepetitions: undefined!,
};
const context1Initial: W1Context = {
  width: 1,
  chr: undefined!,
  chrCode: -1,
};

export class Engine {
  global: boolean;
  root: Match;
  repetitionCount: number;
  index = 0;
  starved = true;
  context0: W0Context = {...context0Initial};
  context1: W1Context = {...context1Initial};
  context: Context = this.context0;
  match: Match;
  prevNode: Node = null!;
  node: Node = null!;

  constructor(pattern: Pattern) {
    this.global = pattern.global;
    this.repetitionCount = getPatternInternal(pattern).initialState.repetitionStates.length;

    this.root = new Match(pattern, 0);
    this.match = this.root;
  }

  get done() {
    return this.root.head === null;
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
    if (match.head === null) throw new Error();
    const { head } = match;
    this.prevNode = head;
    this.node = head.worse;
    this.match = match;
  }

  fail() {
    const { node } = this;
    if (!isSequence(node.data)) throw new Error();

    this.prevNode.worse = this.node = node.worse;
  }

  succeed(captures: Captures) {
    const { node, match } = this;
    if (!isSequence(node.data)) throw new Error();
    const { pattern, globalIdx } = match;

    // Stop matching any worse alternatives
    this.prevNode.worse = this.node = new Node(new Match(pattern, globalIdx + 1, captures));
  }

  explode(matchers: Array<Matcher>) {
    const { node } = this;
    if (!isSequence(node.data)) throw new Error();

    const { worse } = node;
    const { mutableState } = node.data;

    let prev = this.prevNode;
    let seq: Node = undefined!;
    for (const matcher of matchers) {
      seq = new Node(new Sequence(matcher, cloneMatcherState(mutableState)));
      prev.worse = seq;
      prev = seq;
    }

    seq.worse = worse;

    // continue from the first of the nodes we just inserted
    this.node = this.prevNode.worse;
  }

  apply(state: State) {
    const { node } = this;
    if (!isSequence(node.data)) throw new Error();

    if (state.type === failureType) {
      this.fail();
    } else if (state.type === successType) {
      this.succeed(state.captures);
    } else if (state.type === exprType) {
      this.explode(state.seqs);
    } else if (state.type === contType) {
      node.data.next = state;
    } else {
      throw new Error(`Unexpected state of {type: '${(state as any).type}'}`);
    }
  }

  step0() {
    const context = this.context as W0Context;

    let { data } = this.node;
    while (isSequence(data) && data.next.width === 0) {
      this.apply(data.next.match(data.mutableState, context));
      ({ data } = this.node);
    }
  }

  step1() {
    const { node } = this;
    const context = this.context as W1Context;
    const { next, mutableState } = node.data as Sequence;
    if (next.width === 1) {
      this.apply(next.match(mutableState, context));
    } else {
      throw new Error('w0 where w1 expected');
    }
  }

  traverse(step: () => void) {
    this.startTraversal(this.root);

    let { node } = this;
    while (true) {
      while (isSequence(node.data)) {
        const prevNode = node;
        step();
        ({ node } = this);
        if (prevNode === node) {
          this.prevNode = node;
          this.node = node = node.worse;
        }
      }

      if (isMatch(node.data) && node.data.head !== null) {
        this.startTraversal(node.data);
        ({ node } = this);
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

    this.traverse(this.step0.bind(this));


    if (this.context0.nextChr === null) {
      this.traverse(this.fail.bind(this));
    }

    const matches: Array<Captures> = [];

    let match = this.root;
    while (true) {
      if (match.captures !== null) {
        matches.push(match.captures);
        match.captures = null;
      }
      if (match.head !== null && isMatch(match.head.worse.data)) {
        match = match.head.worse.data;
      } else {
        break;
      }
    }

    this.root = match;
    this.context = this.context1;

    return matches;
  }

  traverse1() {

    this.traverse(this.step1.bind(this));

    this.context = this.context0;
    this.starved = true;
  }
}
