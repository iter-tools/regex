import { Pattern, ContinuationResult, Result, ExpressionResult } from './types';

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

export class Sequence {
  // An expression can be distributed into a sequence,
  // so a sequence may be an expression.
  state: State;
  expr: Expression;
  // next, prev in more standard terminology
  better: Sequence | null = null;
  worse: Sequence | null = null;

  constructor(state: ContinuationState, expr: Expression) {
    this.state = state;
    this.expr = expr;
  }

  isOnly() {
    const { worse, better } = this;
    return worse === null && better === null;
  }

  fail(): Sequence | null {
    if (this.state.type === 'expr') {
      throw new Error('Expressions only fail when all their sequences fail');
    }

    let seq: Sequence = this;
    let { expr } = seq;
    while (seq.isOnly() && expr.parent !== null && !expr.isRoot) {
      seq = expr.parent;
      ({ expr } = seq);
    }

    if (expr.isRoot) {
      return expr.terminate(null);
    } else {
      const { worse, better } = seq;
      if (better === null) {
        expr.best = worse;
      } else {
        better.worse = worse;
      }
      if (worse !== null) {
        worse.better = better;
        if (better === null && worse.state.type === 'success') {
          return worse.expr.parent!.succeed(worse.state);
        }
      }
      return seq.next;
    }
  }

  succeed(successState: SuccessState): Sequence | null {
    const { worse } = this;

    let seq: Sequence = this;
    let { expr } = seq;
    while (seq.better === null && expr.parent !== null && !expr.isRoot) {
      seq = expr.parent;
      ({ expr } = seq);
    }

    // make the GC's life a little easier
    if (worse !== null) worse.better = null;

    // stop matching against any less preferable alternate sequences
    seq.worse = null;
    seq.state = successState;

    // Fixup the reference which we bound too early
    if (successState.expr !== null) {
      successState.expr.parent = seq;
    }

    if (expr.isRoot) {
      return expr.terminate(successState);
    } else {
      return seq;
    }
  }

  replaceWith(result: Result): Sequence | null {
    const { engine, globalIdx } = this.expr;
    if (result === null) {
      return this.fail();
    } else if (result.type === 'success') {
      const { type, expr: _expr, captures } = result;
      const expr = _expr === null ? null : new Expression(engine, _expr, globalIdx + 1, this);

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
    const { worse, expr } = this;
    return worse !== null ? worse : expr.parent === null ? null : expr.parent.worse;
  }
}

export class Expression {
  engine: Engine;
  best: Sequence | null;
  parent: Sequence | null;
  isRoot: boolean;
  globalIdx: number;

  constructor(
    engine: Engine,
    expr: ExpressionResult,
    globalIdx: number,
    parent: Sequence | null = null,
  ) {
    this.engine = engine;
    this.parent = parent;
    this.globalIdx = globalIdx;
    this.isRoot = parent === null || parent.expr.globalIdx !== globalIdx;

    const best = new Sequence(null as any, this);
    let prev = best;

    for (const state of expr.expr) {
      const seq = new Sequence(state, this);
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

    const seq = this.parent;

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
          state.expr.parent = null;
          return state.expr.best;
        }
      }

      return null;
    }
  }
}

export class Engine {
  root: Expression | null;
  captures: Array<Array<String | null>>;

  constructor(pattern: Pattern) {
    this.root = new Expression(this, pattern.expr, 0);
    this.captures = [];
  }

  step0(atStart: boolean, atEnd: boolean, idx: number) {
    let seq = this.root === null ? null : this.root.best;

    const context: Record<never, never> = { atStart, atEnd, idx };

    while (seq !== null) {
      const { state } = seq;

      // not sure this is still needed...
      if (state.type === 'expr' || state.type === 'success') {
        seq = state.expr !== null ? state.expr.best : seq.next;
      } else {
        const { next, state: matchState } = state;

        if (next.width === 0) {
          seq = seq.replaceWith(next.match(matchState, context));
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
      const { state } = seq;

      if (state.type === 'expr' || state.type === 'success') {
        seq = state.expr !== null ? state.expr.best : seq.next;
      } else {
        const { next, state: matchState } = state;

        // width must be 1 here
        // it should be as evaluate0 should always be run first
        seq.replaceWith(next.match(matchState, chr));
        seq = seq.next;
      }
    }
  }
}
