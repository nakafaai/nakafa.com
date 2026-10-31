import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, type Transaction } from "@tiptap/pm/state";
import {
  RemoveNodeMarkStep,
  ReplaceStep,
  type Step,
} from "@tiptap/pm/transform";
import { Array as Arr, Function as Fn } from "effect";

/** Tells the writer why a paste left the document as it was, since nothing else says so. */
const refuseOf = (transaction: Transaction, onRefuse: () => void) => {
  // ProseMirror marks the transaction of a paste with this meta.
  if (transaction.getMeta("paste") === true) {
    onRefuse();
  }
  return false;
};

/**
 * The UTF-8 bytes of one step as its JSON text, the text a call sends it in. A size
 * bound counts bytes, so a character of two or more bytes counts as such.
 */
function stepBytes(step: Step): number {
  return utf8Bytes(encodeJsonText(step.toJSON()));
}

/**
 * The UTF-8 bytes of a document as its JSON text, the measure of a snapshot (ADR 0028).
 * The snapshot stores the contract's output, which drops only the attributes that the
 * contract does not name, so the editor's text is at least as long as the stored one.
 */
function documentBytes(doc: Node): number {
  return utf8Bytes(encodeJsonText(doc.toJSON()));
}

/**
 * Whether a step only removes content, or a mark of one node, so the document it makes
 * is no larger. A mark removed from a range is not such a step: when the range ends
 * inside a text node, the node splits in two, and the two serialize to more text than
 * the one did, so that step is measured.
 */
function onlyRemoves(step: Step): boolean {
  if (step instanceof ReplaceStep) {
    return step.slice.size === 0;
  }
  return step instanceof RemoveNodeMarkStep;
}

/**
 * Refuses every edit of this editor that holds a step over `maxBytes`, so the editor
 * never holds an edit that no call can send (ADR 0028 Bounds). The caller passes
 * `MAX_STEP_BYTES` of `@repo/backend/confect/editor/batch`, the largest step text that
 * one call carries, and not the bound of a whole call, because a call also carries
 * its ids and version around the step. A refused paste leaves the document as it was,
 * and `onRefuse` runs. A change that another editor's steps brought in carries the
 * `rebased` meta of the collab plugin, and passes, as it does for `depthGuard`.
 */
export const stepSizePlugin = (maxBytes: number, onRefuse: () => void) =>
  new Plugin({
    filterTransaction: (transaction) =>
      !transaction.docChanged ||
      transaction.getMeta("rebased") !== undefined ||
      Arr.every(transaction.steps, (step) => stepBytes(step) <= maxBytes) ||
      refuseOf(transaction, onRefuse),
  });

/** The extension that mounts `stepSizePlugin`, with the bound its caller passes. */
export const stepSizeGuard = (
  maxBytes: number,
  onRefuse: () => void = Fn.constVoid
) =>
  Extension.create({
    name: "stepSize",
    addProseMirrorPlugins() {
      return [stepSizePlugin(maxBytes, onRefuse)];
    },
  });

/**
 * Refuses an edit that grows the document past `maxBytes`, measured as the snapshot
 * measures it (ADR 0028 Bounds, `MAX_DOCUMENT_BYTES`). The document is measured only
 * when the transaction can grow it: a transaction that only removes content, or a mark
 * of one node, cannot, so it passes without a measure. A document already past the bound stays
 * editable, and an edit that grows it is refused, and when that edit is a paste `onRefuse` runs. A
 * change that another editor's steps brought in carries the `rebased` meta of the collab plugin,
 * and passes.
 */
const documentSizePlugin = (maxBytes: number, onRefuse: () => void) =>
  new Plugin({
    filterTransaction: (transaction, state) => {
      if (
        !transaction.docChanged ||
        transaction.getMeta("rebased") !== undefined ||
        Arr.every(transaction.steps, onlyRemoves)
      ) {
        return true;
      }
      const after = documentBytes(transaction.doc);
      return (
        after <= maxBytes ||
        after <= documentBytes(state.doc) ||
        refuseOf(transaction, onRefuse)
      );
    },
  });

/** The extension that mounts `documentSizePlugin`, with the bound its caller passes. */
export const documentSizeGuard = (
  maxBytes: number,
  onRefuse: () => void = Fn.constVoid
) =>
  Extension.create({
    name: "documentSize",
    addProseMirrorPlugins() {
      return [documentSizePlugin(maxBytes, onRefuse)];
    },
  });
