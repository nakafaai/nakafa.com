import "server-only";

import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/material";

/**
 * Caches only the verified route and metadata required by Next metadata generation.
 */
export async function getPublishedMaterialMetadata(
  input: PublishedMaterialInput
) {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return { metadata: data.metadata, route: data.route };
}
