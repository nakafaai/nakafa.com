import { getScopedReferences } from "@repo/contents/_lib/scoped";
import { ModuleLoadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";

/**
 * Loads article references with an import context restricted to `articles/`.
 */
export function getArticleReferences(filePath: string) {
  return getScopedReferences(
    "articles",
    (relativePath) => {
      const modulePath = `@repo/contents/articles/${relativePath}/ref.ts`;

      return Effect.tryPromise({
        try: () => import(modulePath),
        catch: (cause) =>
          new ModuleLoadError({
            cause,
            message: "Unable to import article references.",
            path: modulePath,
          }),
      });
    },
    filePath
  );
}
