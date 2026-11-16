import { type AnyExtension, Node } from "@tiptap/core";
import { Array as Arr } from "effect";

/**
 * A group of blocks, the contract's `contentStack` or `contentBlock` (ADR 0031): a stack of
 * related blocks, such as a formula and the graph it draws, or one block set apart. It holds one
 * block or more, as the contract requires.
 */
function groupNode(name: "contentBlock" | "contentStack") {
  return Node.create({
    name,
    content: "block+",
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

/** The two groups of blocks a document may hold. */
export function groupExtensions(): AnyExtension[] {
  return Arr.make(groupNode("contentStack"), groupNode("contentBlock"));
}
