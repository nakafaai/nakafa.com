import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Array as Arr, Number as Num } from "effect";

/**
 * How many levels a node nests, counting the node itself: a text node is one level,
 * a paragraph of text is two, and a `doc` holding that paragraph is three. A
 * document's depth is the depth of its `doc` node, which the server bounds (ADR 0028).
 */
export function nodeDepth(node: Node): number {
  return (
    1 +
    Arr.reduce(node.content.content, 0, (deepest, child) =>
      Num.max(deepest, nodeDepth(child))
    )
  );
}

/**
 * Refuses an edit that would nest the document deeper than `maxDepth` levels, so the
 * editor never holds a document the server refuses at its snapshot (ADR 0028). The
 * caller passes the bound of the document contract, `MAX_DOCUMENT_DEPTH`. An edit
 * that does not nest the document deeper always passes, so a document that is
 * already deeper stays editable. A change that another editor's steps brought in
 * carries the `rebased` meta of the collab plugin, and passes, because the server's
 * document is the one that counts for it.
 */
export const depthGuard = (maxDepth: number) =>
  Extension.create({
    name: "documentDepth",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction: (transaction, state) => {
            if (
              !transaction.docChanged ||
              transaction.getMeta("rebased") !== undefined
            ) {
              return true;
            }
            const after = nodeDepth(transaction.doc);
            return after <= maxDepth || after <= nodeDepth(state.doc);
          },
        }),
      ];
    },
  });
