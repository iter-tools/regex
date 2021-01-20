import {
  Pattern,
  ContinuationResult,
  Result,
  ExpressionResult,
  MatchState,
  Width0Matcher,
  W0Context,
  Width1Matcher,
} from './types';

type ExpressionState = {
  type: 'expr';
  expr: Expression;
};

type SuccessState = {
  type: 'success';
  expr: Expression | null;
  captures: Array<Array<string | null>>;
};

type ContinuationState = ContinuationResult;

type State = ExpressionState | ContinuationState | SuccessState;

const cloneMatchState = (state: MatchState) => {
  const { result, captureStack, captureList, repetitionStates } = state;
  return { result, captureStack, captureList, repetitionStates };
};

const noContext = {};

export class Sequence {
  // An expression can be distributed into a sequence,
  // so a sequence may be an expression.
  state: State;
  matchState: MatchState;
  parentExpr: Expression;
  // next, prev in more standard terminology
  better: Sequence | null;
  worse: Sequence | null;

  constructor(state: ContinuationState, matchState: MatchState, expr: Expression) {
    this.state = state;
    this.matchState = matchState;
    this.parentExpr = expr;
    this.better = null;
    this.worse = null;
  }

  maybeHoist(): Sequence {
    const { best, isRoot, parentSeq } = this.parentExpr;
    if (best.worse === null && !isRoot) {
      // if we have an expression of one sequence
      parentSeq!.state = best.state;
      parentSeq!.matchState = best.matchState;

      if (best.state.type === 'expr') {
        best.state.expr.parentSeq = parentSeq;
      }

      return parentSeq!;
    } else {
      return this;
    }
  }

  remove(): Sequence | null {
    const { worse, better, parentExpr } = this;

    let seq: Sequence = null!;
    let seqIsBetter = false;

    if (better !== null) {
      better!.worse = worse;
      seq = better;
      seqIsBetter = true;
    } else {
      parentExpr!.best = worse!;
    }
    if (worse !== null) {
      worse!.better = better;
      seq = worse;
      seqIsBetter = false;
    }

    seq = seq.maybeHoist();

    this.better = this.worse = null;

    return seqIsBetter ? seq.next : seq;
  }

  removeWorse(): Sequence {
    if (this.worse !== null) this.worse.better = null;
    this.worse = null;

    return this.maybeHoist();
  }

  fail(): Sequence | null {
    if (this.state.type === 'expr') {
      throw new Error('Expressions only fail when all their sequences fail');
    }

    let seq: Sequence = this;
    let { worse, better, parentExpr } = seq;

    if (parentExpr.isRoot && better === null && worse === null) {
      return parentExpr.terminate(null);
    } else {
      const seq = this.remove();

      if (seq !== null && seq.state.type === 'success') {
        return parentExpr.parentSeq!.succeed(seq.state);
      }

      return seq;
    }
  }

  succeed(successState: SuccessState): Sequence | null {
    let seq: Sequence = this;
    let { parentExpr } = seq;
    while (seq.better === null && parentExpr.parentSeq !== null && !parentExpr.isRoot) {
      seq = parentExpr.parentSeq;
      ({ parentExpr } = seq);
    }

    seq.state = successState;

    // stop matching against any less preferable alternate sequences
    seq = seq.removeWorse();

    // Fixup the reference which we bound too early
    if (successState.expr !== null) {
      successState.expr.parentSeq = seq;
    }

    if (parentExpr.isRoot && seq.better === null) {
      return parentExpr.terminate(successState);
    } else {
      return seq;
    }
  }

  replaceWith(result: Result, context: W0Context): Sequence | null {
    const { engine, globalIdx } = this.parentExpr;
    if (result.type === 'success') {
      const { type, global, captures } = result;

      const expr = global
        ? new Expression(engine, engine.makeRootState(context), globalIdx + 1, this)
        : null;

      return this.succeed({ type, expr, captures: [captures] });
    } else if (result.type === 'expr') {
      const expr = new Expression(engine, result, globalIdx, this);

      this.state = { type: 'expr', expr };

      return expr.best;
    } else {
      this.state = result;

      return this;
    }
  }

  get next(): Sequence | null {
    let seq: Sequence | null = this;
    while (seq !== null && seq.worse === null) seq = seq.parentExpr.parentSeq;
    return seq === null ? null : seq.worse;
  }
}

export class Expression {
  engine: Engine;
  best: Sequence;
  parentSeq: Sequence | null;
  isRoot: boolean;
  globalIdx: number;

  constructor(
    engine: Engine,
    result: ExpressionResult,
    globalIdx: number,
    parentSeq: Sequence | null = null,
  ) {
    this.engine = engine;
    this.parentSeq = parentSeq;
    this.globalIdx = globalIdx;
    this.isRoot = parentSeq === null || parentSeq.parentExpr.globalIdx !== globalIdx;

    const matchState = parentSeq === null ? engine.initialMatchState : parentSeq.matchState;

    const best = new Sequence(null as any, matchState, this);
    let prev = best;

    for (const state of result.expr) {
      const seq = new Sequence(state, cloneMatchState(matchState), this);
      seq.better = prev;
      prev.worse = seq;
      prev = seq;
    }

    if (best.worse === null) {
      throw new Error('Empty expressions are forbidden');
    }

    best.worse.better = null;
    this.best = best.worse;
  }

  terminate(state: SuccessState | null): Sequence | null {
    if (!this.isRoot) {
      throw new Error('Can only terminate root expressions');
    }

    const seq = this.parentSeq;

    if (seq !== null) {
      if (seq.state.type !== 'success') {
        throw new Error('root expressions must have success parents or no parents');
      }
      const seqState = seq.state;
      if (state !== null) {
        seqState.captures = [...seqState.captures, ...state.captures];
        seqState.expr = state.expr;

        return seqState.expr !== null ? seq : seq.next;
      } else {
        seqState.expr = null;
        return seq.next;
      }
    } else {
      const { engine } = this;
      if (state !== null) {
        engine.captures.push(...state.captures);
        engine.root = state.expr;
        if (state.expr !== null) {
          state.expr.parentSeq = null;
          return state.expr.best;
        }
      } else {
        engine.root = null;
      }

      return null;
    }
  }
}

export class Engine {
  root: Expression | null;
  matcher: Width0Matcher;
  initialMatchState: MatchState;
  repetitionCount: number;
  captures: Array<Array<string | null>>;

  constructor(pattern: Pattern) {
    this.initialMatchState = pattern.initialState;
    this.repetitionCount = pattern.initialState.repetitionStates.length;
    this.matcher = pattern.matcher;
    this.captures = [];
    this.root = null;
  }

  makeRootState(context: W0Context): ExpressionResult {
    return this.matcher.match(cloneMatchState(this.initialMatchState), context) as ExpressionResult;
  }

  step0(atStart: boolean, atEnd: boolean, idx: number) {
    const seenRepetitions = new Array(this.repetitionCount);
    const context: W0Context = { atStart, atEnd, idx, seenRepetitions };

    if (atStart) {
      this.root = new Expression(this, this.makeRootState(context), 0);
    }

    let seq = this.root === null ? null : this.root.best;

    while (seq !== null) {
      const { state, matchState } = seq;

      if (state.type !== 'cont') {
        seq = state.expr !== null ? state.expr.best : seq.next;
      } else {
        const { next } = state;

        if (next.width === 0) {
          const result = next.match(matchState, context);
          seq = result === null ? seq.fail() : seq.replaceWith(result, context);
        } else if (atEnd) {
          seq = seq.fail();
        } else {
          seq = seq.next;
        }
      }
    }

    const { root, captures } = this;
    const done = root === null;

    if (captures.length > 0) {
      this.captures = [];
      return { value: captures, done };
    } else {
      return { value: null, done };
    }
  }

  step1(chr: string) {
    const { best } = this.root!;

    let seq: Sequence | null = best;

    while (seq !== null) {
      const { state, matchState } = seq;

      if (state.type !== 'cont') {
        seq = (state.expr !== null ? state.expr.best : seq.next) as Sequence | null;
      } else {
        const { next } = state;

        // width must be 1 here
        // it should be as step0 should always be run first
        const result = (next as Width1Matcher).match(matchState, chr, noContext);
        if (result === null) {
          seq = seq.fail();
        } else {
          seq = seq.replaceWith(result, noContext as any);
          seq = seq === null ? null : seq.next;
        }
      }
    }
  }
}
