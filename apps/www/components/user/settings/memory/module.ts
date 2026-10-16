import { Effect } from "effect";

/** Loads the rich editor at its dynamic boundary. */
export function loadRichEditorModule() {
  return import("@repo/design-system/components/editor/rich");
}

/** Loads the preview of the saved words, which the editor shows while its code loads. */
export function loadEditorPreviewModule() {
  return import("@repo/design-system/components/editor/words");
}

/**
 * The intent a learner shows on a memory or on the add button: a focus, a pointer
 * over it or a press. It starts the editor and its preview at once, each on its
 * own fiber, so a load that fails does not hold up the other. A failed load is
 * not reported here: the open asks for the same module again and reports the
 * failure there.
 */
export function warmMemoryEditor() {
  Effect.runFork(Effect.tryPromise(loadRichEditorModule));
  Effect.runFork(Effect.tryPromise(loadEditorPreviewModule));
}
