/**
 * Makes a load share one promise while it is in flight and once it has
 * succeeded. A failed load is forgotten, so the next request loads the module
 * again. React's `lazy` keeps a failed import for the life of the page, so
 * code that a page loads on intent, such as an editor, is loaded through this.
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
