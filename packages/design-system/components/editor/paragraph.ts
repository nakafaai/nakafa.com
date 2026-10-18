import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { MutableList } from "effect";

/**
 * A decoration on each paragraph of a document, with the classes that the published article
 * draws its paragraphs with. A decoration styles the view only: no node changes, so the stored
 * document is the same as before.
 */
const paragraphDecorations = (doc: Node) => {
  const decorations = MutableList.make<Decoration>();
  doc.descendants((node, position) => {
    if (node.type.name === "paragraph") {
      MutableList.append(
        decorations,
        Decoration.node(position, position + node.nodeSize, {
          class: paragraphVariants(),
        })
      );
    }
  });
  return DecorationSet.create(doc, MutableList.toArray(decorations));
};

/** Draws the paragraphs of an editor as the published article draws them. */
export const articleParagraphs = Extension.create({
  name: "articleParagraphs",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => paragraphDecorations(state.doc),
        },
      }),
    ];
  },
});
