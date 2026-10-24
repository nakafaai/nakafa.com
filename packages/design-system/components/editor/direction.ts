import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Array as Arr, MutableList } from "effect";

/**
 * The blocks whose direction follows their own text. A paragraph of a list item is not one of them:
 * its item reads the same words, so the item takes the direction and the paragraph leaves it to the
 * item, as `lib/markdown/direction.ts` does for a Markdown answer.
 */
const BLOCKS = ["heading", "listItem", "paragraph", "tableCell", "tableHeader"];

/** Whether a node reads in the direction of its own text, given the node that holds it. */
function readsItsText(node: Node, parent: Node | null) {
  if (!Arr.contains(BLOCKS, node.type.name)) {
    return false;
  }
  return !(node.type.name === "paragraph" && parent?.type.name === "listItem");
}

/**
 * A decoration on each block that reads its own text, with `dir="auto"`. A decoration styles the view
 * only, so no node changes: an attribute on the node would be stored with the document, and the
 * contract of an assessment document does not hold it.
 */
const directionDecorations = (doc: Node) => {
  const decorations = MutableList.make<Decoration>();
  doc.descendants((node, position, parent) => {
    if (readsItsText(node, parent)) {
      MutableList.append(
        decorations,
        Decoration.node(position, position + node.nodeSize, { dir: "auto" })
      );
    }
  });
  return DecorationSet.create(doc, MutableList.toArray(decorations));
};

/**
 * Lets each block of an editor take the direction of its own words, so an Arabic paragraph starts on
 * its own side in an Indonesian document, and a pasted block keeps the direction of its text.
 */
export const blockDirections = Extension.create({
  name: "blockDirections",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => directionDecorations(state.doc),
        },
      }),
    ];
  },
});

/** The tags of the blocks that read their own text, as the schema's DOM serializer draws them. */
const BLOCK_TAGS = "h1, h2, h3, h4, h5, h6, li, p, td, th";

/**
 * Sets `dir="auto"` on each block of a document that is drawn without an editor, with the rule of
 * `blockDirections`: a paragraph in a list item leaves the direction to its item.
 */
export function markBlockDirections(root: HTMLElement) {
  Arr.forEach(Arr.fromIterable(root.querySelectorAll(BLOCK_TAGS)), (block) => {
    if (block.tagName === "P" && block.parentElement?.tagName === "LI") {
      return;
    }
    block.setAttribute("dir", "auto");
  });
}
