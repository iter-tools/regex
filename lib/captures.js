function* flattenCapture(capture) {
  yield capture.value;
  if (capture.value !== null) {
    for (const subCapture of capture.children) {
      yield* flattenCapture(subCapture);
    }
  }
}

module.exports = { flattenCapture };
