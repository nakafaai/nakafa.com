import type { BlockNode } from "@nakafa/aksara-contracts/assessment/document";
import { Array as Arr, MutableList } from "effect";

type MathBlockNode = Extract<BlockNode, { readonly type: "mathBlock" }>;

function isMathBlock(block: BlockNode): block is MathBlockNode {
  return block.type === "mathBlock";
}

/**
 * The nodes of one level of an assessment document, each with the key React lists it by. A node has
 * no identity of its own, and a published document never changes, so its place in the level is its
 * key.
 */
export function placeNodes<Node>(nodes: readonly Node[]) {
  return Arr.map(nodes, (node, index) => ({ key: String(index), node }));
}

/**
 * Wraps runs of two or more consecutive bare `mathBlock` siblings into a single `mathContainer`
 * node so legacy assessment documents fuse stacked formulas identically to lessons and new try-outs.
 * A single standalone `mathBlock` stays bare.
 */
export function groupConsecutiveMath(
  blocks: readonly BlockNode[]
): readonly BlockNode[] {
  const result = MutableList.make<BlockNode>();
  let remaining = blocks;

  while (remaining.length > 0) {
    const [mathRun, rest] = Arr.span(remaining, isMathBlock);
    if (Arr.isReadonlyArrayNonEmpty(mathRun)) {
      MutableList.append(
        result,
        mathRun.length >= 2
          ? { content: mathRun, type: "mathContainer" }
          : mathRun[0]
      );
      remaining = rest;
      continue;
    }
    const [otherRun, after] = Arr.span(
      remaining,
      (block) => !isMathBlock(block)
    );
    MutableList.appendAll(result, otherRun);
    remaining = after;
  }

  return MutableList.toArray(result);
}
