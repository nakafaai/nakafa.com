import "server-only";

import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/exchange";

/**
 * Caches only the verified route and metadata required by Next metadata generation.
 */
export async function getPublishedMaterialMetadata(
  input: PublishedMaterialInput
) {
  "use cache";

  applyPublishedContentCache();
  const data = await Effect.runPromise(readPublishedMaterial(input));

  return { metadata: data.metadata, route: data.route };
}
