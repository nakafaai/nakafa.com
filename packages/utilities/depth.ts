import { Array as Arr, Number as Num } from "effect";

/**
 * How many levels a node nests, counting the node itself: a text node is one level, a
 * paragraph of text is two, and a `doc` holding that paragraph is three. A document's
 * depth is the depth of its `doc` node, which the server bounds (ADR 0028).
 *
 * A node holds its children in `content.content`, as a ProseMirror node holds its
 * fragment. No Schema describes a ProseMirror node, and the design system and the
 * server each hold nodes of their own, so the function takes any node of that shape.
 */
export function nodeDepth<
  N extends { readonly content: { readonly content: readonly N[] } },
>(node: N): number {
  return (
    1 +
    Arr.reduce(node.content.content, 0, (deepest, child) =>
      Num.max(deepest, nodeDepth(child))
    )
  );
}
