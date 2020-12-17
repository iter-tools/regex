function* flattenCapture(capture) {
  yield capture.value;
  if (capture.value !== null) {
    for (const subCapture of capture.subCaptures) {
      yield* flattenCapture(subCapture);
    }
  }
}

module.exports = { flattenCapture };
