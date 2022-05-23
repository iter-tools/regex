export const debugPrint = (matcher: any): string | null => {
  if (matcher === null) return null;

  let m = matcher;
  let str = '';
  while (m !== null) {
    if (typeof matcher.match !== 'function') {
      throw new Error('debugPrint can only print matchers.');
    }

    switch (m.name) {
      case 'literal':
        str += m.value;
        break;
      case 'boundaryAssertion':
        str += '\\b';
        break;
      case 'edgeAssertion':
        str += m.kind === 'start' ? '^' : '$';
        break;
      case 'repeat':
        if (m.repeatCont.name !== 'unmatched') {
          str += `(${m.exprCont.seqs.map((m: any) => debugPrint(m)).join('|')})*`;
        }
        break;
      case 'expression':
        str += `(${m.matchers.map((m: any) => debugPrint(m)).join('|')})`;
        // m.next is already distributed into m.matchers -- don't print it twice!
        return str;
      default:
        break;
    }
    m = m.next;
  }
  return str;
};
