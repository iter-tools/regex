export async function* map<V, M>(
  iterable: AsyncIterable<V>,
  mapper: (v: V) => M | Promise<M>,
): AsyncIterable<M> {
  for await (const value of iterable) {
    yield await mapper(value);
  }
}
