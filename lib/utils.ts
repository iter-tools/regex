export function* map<V, M>(iterable: Iterable<V>, mapper: (v: V) => M): Iterable<M> {
  for (const value of iterable) {
    yield mapper(value);
  }
}
