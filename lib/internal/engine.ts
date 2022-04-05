import { code } from './literals';
import {
  State,
  MatcherState,
  Width0Matcher,
  W0Context,
  W1Context,
  Matcher,
  exprType,
  successType,
  contType,
} from './types';
import { Pattern, getPatternInternal } from '../pattern';

/*
 ┌───────────────────────┐                                   ┌───────────────┐
 │ Engine data structure │           ┌─────────┐             │   Sequence    │
 │                       │           │ Matcher │             └──────┬────────┘
 │ Diagram created with  │           └─────────┘             parent │  ▲
 │ https://asciiflow.com │                  ▲                       ▼  │ best
 └───────────────────────┘                  │ next           ┌─────────┴─────┐
                            better ┌────────┴─────┐  better  │    Match      │
           ┌─────────┐     null ◄──┤   Sequence   │◄─────────┤ captures: ['']│
           │ Matcher │             │              │  worse   │ globalIdx: 1  │  worse
           └─────────┘             └──────┬───────┴─────────►└──────┬──┬─────┴──► null
                  ▲                parent │ ▲                parent │  │ engine
                  │ next                  ▼ │ best                  │  │
  better ┌────────┴─────┐  better  ┌────────┴─────┐ ◄───────────────┘  │
 null ◄──┤   Sequence   │◄─────────┤  Expression  │                    │
         │              │  worse   │              │  worse             │
         └──────┬───────┴─────────►└──────┬───────┴──► null            │
         parent │ ▲                parent │                            │
                ▼ │ best                  │                            │
         ┌────────┴─────┐ ◄───────────────┘                            │
         │    Match     │                                              │
         │ captures: [] │ engine                                       ▼
         │ globalIdx: 0 ├──────────────────────────────────► ┌─────────────┐
         └────────┬─────┘                                    │   Engine    │
                  │ parent                                   │             │
                  ▼  null                                    └─────────────┘
 */

export type Captures = Array<string | undefined>;

const cloneMatcherState = (state: MatcherState) => {
  const { result, captureStack, captureList, repetitionStates } = state;
  return { result, captureStack, captureList, repetitionStates };
};

const noContext: W1Context = {};

const nextSeq = (node: Node | null): Sequence | null => {
  let n: Node = node!;
  // This algorithm can be summarized as: (up* check down* over)+
  // The directions are in reference to the diagram above
  if (n !== null) {
    // prettier-ignore
    for (;;) {
      while (n instanceof Expression && n.best !== null) n = n.best; // up*
      if (n instanceof Sequence && n !== node) break; // check
      while (n.parent !== null && n.worse === null) n = n.parent; // down*
      if (n.worse !== null) n = n.worse; // over
      else break;
    }
  }

  return n instanceof Match ? null : (n as Sequence);
};

const getSeq = (node: Node | null): Sequence | null => {
  return node instanceof Sequence ? node : nextSeq(node);
};

export class Node {
  // next, prev in more standard terminology
  better: Node | null;
  worse: Node | null;
  // yes, parent can be null but only the root expression has no parent, and we need
  // even more meticulous handling than just null checking there
  parent: Expression;

  constructor(parent: Expression) {
    this.parent = parent;
    this.better = null;
    this.worse = null;
  }

  replaceWith<T extends Node>(node: T): T {
    const { worse, better, parent } = this;
    if (worse !== null) worse.better = node;
    if (better !== null) better.worse = node;
    if (parent !== null && parent.best === this) parent.best = node;
    node.parent = parent;
    node.better = better;
    node.worse = worse;
    return node;
  }

  remove(): void {
    const { worse, better, parent } = this;

    // better and worse will never both be null except at the root node
    // thus we will always have a next
    let sibling: Node = null!;

    if (better !== null) {
      better.worse = worse;
      sibling = better;
    } else {
      parent.best = worse!;
    }
    if (worse !== null) {
      worse!.better = better;
      sibling = worse;
    }

    if (sibling === null) {
      if (!(parent instanceof Match)) throw new Error('Unepxected singleton expression');
      parent.best = null;
    } else if (sibling.better === null && sibling.worse === null && !(parent instanceof Match)) {
      // make sure better and worse will (almost) never both be null!
      parent.replaceWith(sibling);
    }
  }

  removeWorse(): Node {
    const { better, worse, parent } = this;
    if (worse !== null) worse.better = null;
    this.worse = null;

    if (better === null && !(parent instanceof Match)) {
      parent.replaceWith(this);
    }
    return this;
  }
}

export class Sequence extends Node {
  next: Matcher;
  mutableState: MatcherState;

  constructor(parent: Expression, next: Matcher, mutableState: MatcherState) {
    super(parent);
    this.next = next;
    this.mutableState = mutableState;
  }

  fail(): Sequence | null {
    const { worse, better, parent } = this;

    if (parent instanceof Match && better === null && worse === null) {
      parent.best = null;
      return getSeq(parent);
    } else {
      this.remove();

      // const node = this.worse !== null ? getSeq(this.worse) : nextSeq(this);
      // return getSeq(this.worse !== null && this.worse instanceof Match ? this.worse.promote() : node);

      if (this.worse !== null && this.worse instanceof Match) {
        this.worse.promote();
      }
      return nextSeq(this);
    }
  }

  succeed(captures: Captures): Sequence | null {
    const { parent } = this;
    const { engine, globalIdx } = parent.match;

    const match = new Match(this.parent, engine, engine.global ? globalIdx + 1 : -1, [captures]);

    if (engine.global) {
      match.buildSequences([engine.matcher], cloneMatcherState(engine.initialMatchState));
    }

    this.replaceWith(match);

    return getSeq(match.promote());
  }

  explode(seqs: Array<Matcher>) {
    const { parent, better, worse } = this;
    if (better === null && worse === null && parent instanceof Match) {
      return getSeq(parent.buildSequences(seqs, this.mutableState));
    } else {
      const expr = new Expression(parent).buildSequences(seqs, this.mutableState);
      return getSeq(this.replaceWith(expr));
    }
  }

  apply(state: State | null): Sequence | null {
    if (state === null) {
      return this.fail();
    } else if (state.type === successType) {
      return this.succeed(state.captures);
    } else if (state.type === exprType) {
      return this.explode(state.seqs);
    } else if (state.type === contType) {
      this.next = state;
      return this;
    } else {
      throw new Error(`Unexpected state of {type: '${(state as any).type}'}`);
    }
  }
}

function* childrenOf(expr: Expression) {
  let seq = expr.best;
  while (seq !== null) {
    yield seq;
    seq = seq.worse;
  }
}

// An expression serves as the head of a linked list of sequences
export class Expression extends Node {
  match: Match;
  // The best child. Pending matches may have no children.
  best: Node | null;

  constructor(parent: Expression) {
    super(parent);
    this.match = this instanceof Match ? this : parent.match;
    this.best = null;
  }

  buildSequences(matchers: Array<Matcher>, mutableState: MatcherState) {
    const best = new Sequence(this, null!, mutableState);
    let prev = best;

    for (const matcher of matchers) {
      const seq = new Sequence(this, matcher, cloneMatcherState(mutableState));
      seq.better = prev;
      prev.worse = seq;
      prev = seq;
    }

    if (best.worse === null) {
      throw new Error('Empty expressions are forbidden');
    }

    best.worse.better = null;

    this.best = best.worse;
    return this;
  }

  get children() {
    return childrenOf(this);
  }
}

// A match represents two closely related things:
//   - a pending match: the root expression of a continuing line of evaluation which may or may not succeed
//   - a successful match: a placeholder for results while better alternatives being evaluated
// When the global flag is enabled a single match may be both these things at the same time.
export class Match extends Expression {
  engine: Engine;
  // Disambiguate between successive occurences of the pattern when matching globally
  globalIdx: number;
  // An array of captures
  // In a global pattern successive global matches may succeed while waiting for a better match to resolve
  matches: Array<Captures>;

  constructor(parent: Expression, engine: Engine, globalIdx: number, matches: Array<Captures>) {
    super(parent);
    this.engine = engine;
    this.globalIdx = globalIdx;
    this.matches = matches;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  replaceWith<T extends Node>(node: T): T {
    if (!(node instanceof Match)) throw new Error('Cannot replace match with non-match');
    this.matches.push(...node.matches);
    node.matches = this.matches;
    if (this.parent === null) {
      this.engine.root = node;
    }
    return super.replaceWith(node);
  }

  // Put this match in its correct position in the structure, eliminating any worse sequences
  promote(): Expression | null {
    let expr: Expression = this;
    // A single match may break out of multiple layers of nesting
    while (expr.better === null && (expr === this || !(expr instanceof Match))) {
      expr = expr.parent;
    }

    if (expr !== this && expr instanceof Match) {
      return expr.replaceWith(this);
    } else {
      expr.removeWorse();
      if (expr !== this) expr.replaceWith(this);
      return expr;
    }
  }
}

export class Engine {
  global: boolean;
  root: Match;
  matcher: Width0Matcher;
  initialMatchState: MatcherState;
  repetitionCount: number;

  constructor(pattern: Pattern) {
    const { initialState, matcher } = getPatternInternal(pattern);
    this.global = pattern.global;
    this.initialMatchState = initialState;
    this.repetitionCount = initialState.repetitionStates.length;
    this.matcher = matcher;

    this.root = new Match(null!, this, pattern.global ? 0 : -1, []);
    this.root.buildSequences([matcher], initialState);
  }

  step0(lastChr: string | null, nextChr: string | null = null) {
    const atStart = lastChr === null;
    const atEnd = nextChr === null;
    const seenRepetitions = new Array(this.repetitionCount);
    const context: W0Context = {
      atStart,
      atEnd,
      lastChr,
      lastCode: lastChr ? code(lastChr) : null,
      nextChr,
      nextCode: nextChr ? code(nextChr) : null,
      seenRepetitions,
    };

    let seq: Sequence | null = nextSeq(this.root);

    while (seq !== null) {
      const { next, mutableState } = seq;

      if (next.width === 0) {
        // Match against any number of chained width 0 states
        seq = seq.apply(next.match(mutableState, context));
      } else if (atEnd) {
        // the input ended before the pattern succeeded
        seq = seq.fail();
      } else {
        seq = nextSeq(seq);
      }
    }

    const { root } = this;
    const { matches } = root;

    if (matches.length > 0) {
      root.matches = [];
      return { value: matches, done: root.best === null };
    } else {
      return { value: null, done: root.best === null };
    }
  }

  step1(chr: string) {
    let seq = nextSeq(this.root);

    while (seq !== null) {
      const { next, mutableState } = seq;

      if (next.width !== 1) {
        throw new Error('Unexpectedly ran step1 with width 0 matchers active');
      }

      const node = seq.apply(next.match(mutableState, chr, code(chr), noContext));
      // Remove returns the nextSeq, so don't skip it
      seq = node === seq ? nextSeq(node) : node;
    }
  }
}
