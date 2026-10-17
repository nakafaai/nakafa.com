import { nodeDepth } from "@repo/utilities/depth";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

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
