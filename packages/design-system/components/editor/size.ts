import { encodeJsonText } from "@repo/utilities/json";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr } from "effect";

/**
 * The UTF-8 bytes of one step as its JSON text, the text a call sends it in. A size
 * bound counts bytes, so a character of two or more bytes counts as such.
 */
function stepBytes(step: Step): number {
  return new TextEncoder().encode(encodeJsonText(step.toJSON())).byteLength;
}

/**
 * Refuses every edit of this editor that holds a step over `maxBytes`, so the editor
 * never holds an edit that no call can send (ADR 0028 Bounds). The caller passes the
 * bound of the sync, which is the bound of one call. A refused paste leaves the
 * document as it was. A change that another editor's steps brought in carries the
 * `rebased` meta of the collab plugin, and passes, as it does for `depthGuard`.
 */
export const stepSizeGuard = (maxBytes: number) =>
  Extension.create({
    name: "stepSize",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction: (transaction) =>
            !transaction.docChanged ||
            transaction.getMeta("rebased") !== undefined ||
            Arr.every(transaction.steps, (step) => stepBytes(step) <= maxBytes),
        }),
      ];
    },
  });
