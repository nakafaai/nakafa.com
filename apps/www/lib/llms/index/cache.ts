import { Effect } from "effect";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { getLlmsSectionIndexText } from "@/lib/llms/index/generate";

/** Caches section index generation at the Next.js Cache Components boundary. */
export async function getCachedLlmsSectionIndexText({
  cleanSlug,
}: {
  cleanSlug: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getLlmsSectionIndexText(cleanSlug));
}
