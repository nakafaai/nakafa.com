import { Array as Arr } from "effect";

/**
 * The nodes of one level of an assessment document, each with the key React lists it by. A node has
 * no identity of its own, and a published document never changes, so its place in the level is its
 * key.
 */
export function placeNodes<Node>(nodes: readonly Node[]) {
  return Arr.map(nodes, (node, index) => ({ key: String(index), node }));
}
