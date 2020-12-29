import { Capture } from './types';

export function* flattenCapture(capture: Capture): Iterable<string | null> {
  yield capture.result;
  if (capture.result !== null) {
    for (const subCapture of capture.children) {
      yield* flattenCapture(subCapture);
    }
  }
}
