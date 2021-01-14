// @ts-ignore
import _createTree from 'functional-red-black-tree';

export type ImmutableTree<K, V> = {
  get(key: K): V;
  insert(key: K, value: V): ImmutableTree<K, V>;
  find(key: K): { update: (value: V) => ImmutableTree<K, V> };
};

export const createTree: <K, V>(
  comparator: (a: K, b: K) => number,
) => ImmutableTree<K, V> = _createTree;