import { Effect } from "effect";
import { applyContentCache } from "@/lib/content/cache";
import {
  getLlmsSectionIndexText,
  readLlmsIndexCacheScopes,
} from "@/lib/llms/index/generate";

/** Caches section index generation at the Next.js Cache Components boundary. */
export async function getCachedLlmsSectionIndexText({
  cleanSlug,
}: {
  cleanSlug: string;
}) {
  "use cache";

  return await Effect.runPromise(
    Effect.gen(function* () {
      const scopes = yield* readLlmsIndexCacheScopes(cleanSlug);
      if (!scopes) {
        return null;
      }
      yield* Effect.sync(() => applyContentCache(...scopes));
      return yield* getLlmsSectionIndexText(cleanSlug);
    })
  );
}
