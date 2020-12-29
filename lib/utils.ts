export function* map<S, T>(source: Iterable<S>, mapper: (value: S) => T): Iterable<T> {
  for (const value of source) {
    yield mapper(value);
  }
}
