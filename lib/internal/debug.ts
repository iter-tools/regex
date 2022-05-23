import { Matcher } from './types';

export const debugPrint = (matcher: any): string | null => {
  if (matcher === null) return null;

  let m: Matcher | null = matcher;
  let str = '';
  while (m !== null) {
    const { props } = m;

    if (typeof matcher.match !== 'function') {
      throw new Error('debugPrint can only print matchers.');
    }

    switch (m.name) {
      case 'literal':
        str += props.value;
        break;
      case 'boundaryAssertion':
        str += '\\b';
        break;
      case 'edgeAssertion':
        str += props.kind === 'start' ? '^' : '$';
        break;
      case 'repeat':
        if (props.repeatCont.name !== 'unmatched') {
          str += `(${props.exprCont.seqs.map((m: any) => debugPrint(m)).join('|')})*`;
        }
        break;
      case 'expression':
        str += `(${props.matchers.map((m: any) => debugPrint(m)).join('|')})`;
        // next is already distributed into matchers
        return str;
      default:
        break;
    }
    m = m.next as Matcher;
  }
  return str;
};
