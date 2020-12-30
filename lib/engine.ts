import emptyStack from '@iter-tools/imm-stack';
import { flattenCapture } from './captures';
import { Pattern, ContinuationResult, Result, SuccessResult, ExpressionResult } from './types';

type ExpressionState = {
  type: 'expr';
  expr: Expression;
};

type SuccessState = SuccessResult;

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

  // problem(?): best is never updated
  fail(): Sequence | null {
    if (this.state.type === 'expr') {
      throw new Error('Expressions only fail when all their sequences fail');
    }

    let seq: Sequence = this;
    while (seq.expr.parent !== null && seq.isOnly()) {
      seq = seq.expr.parent;
    }

    const { worse, better, expr } = seq;
    if (better === null) {
      expr.best = worse!;
    } else {
      better.worse = worse;
    }
    if (worse !== null) {
      worse.better = better;
      if (better === null && worse.state.type === 'success') {
        return worse.succeed(worse.state);
      }
    }
    return seq.next;
  }

  succeed(successResult: SuccessState): Sequence {
    const { worse } = this;

    let seq: Sequence = this;
    while (seq.expr.parent !== null && seq.better === null) {
      seq = seq.expr.parent;
    }

    // make the GC's life a little easier
    if (worse !== null) worse.better = null;

    // stop matching against any less preferable alternate sequences
    seq.worse = null;
    seq.state = successResult;
    return seq;
  }

  replaceWith(result: Result) {
    if (result.type === 'failure') {
      return this.fail();
    } else if (result.type === 'success') {
      return this.succeed(result);
    } else if (result.type === 'expr') {
      const expr = new Expression(result.expr, this);
      this.state = {
        type: 'expr',
        expr,
      };
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

type StepProps = {
  atStart: boolean;
  atEnd: boolean;
  chr: string;
  index: number; // for debugging
};

export class Expression {
  best: Sequence;
  parent: Sequence | null;

  static fromPattern(pattern: Pattern): Expression {
    return new Expression(
      (pattern.matcher.match({
        result: null,
        captures: {
          stack: emptyStack,
          list: emptyStack,
        },
      }) as ExpressionResult).expr,
    );
  }

  constructor(seqs: Iterable<ContinuationResult>, parent: Sequence | null = null) {
    this.parent = parent;

    const best = new Sequence(null as any, this);
    let tail = best;
    if (seqs != null) {
      for (const state of seqs) {
        const { worse } = tail;
        const seq = new Sequence(state, this);
        seq.better = tail;
        seq.worse = worse;
        tail.worse = seq;
        if (worse !== null) worse.better = seq;
        tail = seq;
      }
    }

    if (best.worse === null) {
      throw new Error('Empty expressions are forbidden');
    }

    best.worse.better = null;
    this.best = best.worse;
  }

  evaluate({ atStart, atEnd, chr, index }: StepProps) {
    const { best } = this;

    let seq: Sequence | null = best;

    while (seq !== null && best!.state.type !== 'success') {
      const hasChr = chr !== '';
      // I don't understand why this errors with destructuring
      const state: State = seq.state;

      if (state.type === 'expr') {
        seq = state.expr.best;
      } else {
        if (state.type !== 'success') {
          const { next, state: matchState } = state;

          if (next.width === 0) {
            seq = seq.replaceWith(next.match(matchState));
          } else if (atEnd) {
            seq = seq.fail();
          } else if (hasChr) {
            seq.replaceWith(next.match(matchState, chr));
            seq = seq.next;
          } else {
            seq = seq.next;
          }
        } else {
          seq = seq.next;
        }
      }
    }
  }
}

export class Engine {
  root: Expression;

  constructor(pattern: Pattern) {
    this.root = Expression.fromPattern(pattern);
  }

  next(opts: StepProps) {
    this.root.evaluate(opts);

    const { best } = this.root;

    if (best === null) {
      return { value: null, done: true };
    } else if (best.state.type === 'success') {
      return { value: [...flattenCapture(best.state.capture)], done: true };
    } else {
      return { value: null, done: false };
    }
  }
}
