import type { AnyExtension } from "@tiptap/core";
import { Node } from "@tiptap/core";
import { Array as Arr } from "effect";

/**
 * A group of blocks, the contract's `contentStack`, `contentGrid`, or `contentBlock` (ADR 0031):
 * a vertical stack, grid, or single block set apart, holding one block or more.
 */
function groupNode(
  name: "contentBlock" | "contentGrid" | "contentStack" | "mathContainer",
  content: "block+" | "mathBlock+"
) {
  return Node.create({
    name,
    content,
    defining: true,
    group: "block",
    parseHTML() {
      return [{ tag: `div[data-type="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", { ...HTMLAttributes, "data-type": name }, 0];
    },
  });
}

/** The container groups a document may hold: content stacks, grids, blocks, and stacked math. */
export function groupExtensions(): AnyExtension[] {
  return Arr.make(
    groupNode("contentStack", "block+"),
    groupNode("contentGrid", "block+"),
    groupNode("contentBlock", "block+"),
    groupNode("mathContainer", "mathBlock+")
  );
}
