import { Capture } from './types';

function _flattenCapture(capture: Capture, captures: Array<string | null>) {
  const { result, children, idx } = capture;
  captures[idx] = result;
  if (result !== null) {
    for (const subCapture of children) {
      _flattenCapture(subCapture, captures);
    }
  }
}

export function flattenCapture(capture: Capture, capturesLen: number): Array<string | null> {
  const captures = new Array(capturesLen).fill(undefined);
  _flattenCapture(capture, captures);
  return captures;
}
