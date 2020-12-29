import emptyStack from '@iter-tools/imm-stack';
import { flattenCapture } from './captures';
import { Pattern, ContinuationResult, Result, SuccessResult, SeqsResult } from './types';

type ExpressionResult = {
  type: 'expr';
  expr: Expression;
};

export class Sequence {
  // An expression can be distributed into a sequence,
  // so a sequence may be an expression.
  value: ExpressionResult | ContinuationResult | SuccessResult;
  expr: Expression;
  // next, prev in more standard terminology
  better: Sequence | null = null;
  worse: Sequence | null = null;

  constructor(value: ContinuationResult, expr: Expression) {
    this.value = value;
    this.expr = expr;
  }

  isOnly() {
    const { worse, better } = this;
    return worse === null && better === null;
  }

  // problem(?): best is never updated
  fail(): Sequence | null {
    if (this.value.type === 'expr') {
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
      if (better === null && worse.value.type === 'success') {
        return worse.succeed(worse.value);
      }
    }
    return seq.next;
  }

  succeed(successResult: SuccessResult): Sequence {
    const { worse } = this;

    let seq: Sequence = this;
    while (seq.expr.parent !== null && seq.better === null) {
      seq = seq.expr.parent;
    }

    // make the GC's life a little easier
    if (worse !== null) worse.better = null;

    // stop matching against any less preferable alternate sequences
    seq.worse = null;
    seq.value = successResult;
    return seq;
  }

  replaceWith(result: Result) {
    if (result.type === 'failure') {
      return this.fail();
    } else if (result.type === 'success') {
      return this.succeed(result);
    } else if (result.type === 'seqs') {
      const expr = new Expression(result.seqs, this);
      this.value = {
        type: 'expr',
        expr,
      };
      return expr.best;
    } else {
      this.value = result;
      return this;
    }
  }

  get next(): Sequence | null {
    const { worse, expr } = this;
    return worse !== null ? worse : expr.parent === null ? null : expr.parent.worse;
  }
}

type NextArg = {
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
      }) as SeqsResult).seqs,
    );
  }

  constructor(seqs: Iterable<ContinuationResult>, parent: Sequence | null = null) {
    this.parent = parent;

    const best = new Sequence(null as any, this);
    let tail = best;
    if (seqs != null) {
      for (const value of seqs) {
        const { worse } = tail;
        const seq = new Sequence(value, this);
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

  next({ atStart, atEnd, chr, index }: NextArg) {
    const { best } = this;

    let seq: Sequence | null = best;

    while (seq !== null && best!.value.type !== 'success') {
      const hasChr = chr !== '';
      // I don't understand why this errors with destructuring
      const value: ExpressionResult | ContinuationResult | SuccessResult = seq.value;

      if (value.type === 'expr') {
        seq = value.expr.best;
      } else {
        if (value.type !== 'success') {
          const { next, state } = value;

          if (next.width === 0) {
            seq = seq.replaceWith(next.match(state));
          } else if (atEnd) {
            seq = seq.fail();
          } else if (hasChr) {
            seq.replaceWith(next.match(state, chr));
            seq = seq.next;
          } else {
            seq = seq.next;
          }
        } else {
          seq = seq.next;
        }
      }
    }

    if (best === null) {
      return { value: null, done: true };
    } else if (best.value.type === 'success') {
      return { value: [...flattenCapture(best.value.capture)], done: true };
    } else {
      return { value: null, done: false };
    }
  }
}
