import { Effect } from "effect";

/**
 * Makes a load share one promise while it is in flight and once it has
 * succeeded. A failed load is forgotten, so the next request loads the module
 * again. React's `lazy` keeps a failed import for the life of the page, so the
 * editor's code is loaded through this instead.
 */
export function memoizeLoad<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | undefined;

  return () => {
    loading ??= load().catch((error: unknown) => {
      loading = undefined;
      return Promise.reject(error);
    });

    return loading;
  };
}

/** Loads the rich editor at its dynamic boundary. */
export const loadRichEditorModule = memoizeLoad(
  () => import("@repo/design-system/components/editor/rich")
);

/** Loads the preview of the saved words, which the editor shows while its code loads. */
export const loadEditorPreviewModule = memoizeLoad(
  () => import("@repo/design-system/components/editor/words")
);

/**
 * The intent a learner shows on a memory or on the add button: a focus, a pointer
 * over it or a press. It starts the editor and its preview at once, each on its
 * own fiber, so a load that fails does not hold up the other. A failed load is
 * not reported here, and the next request for that module loads it again.
 */
export function warmMemoryEditor() {
  Effect.runFork(Effect.tryPromise(loadRichEditorModule));
  Effect.runFork(Effect.tryPromise(loadEditorPreviewModule));
}
