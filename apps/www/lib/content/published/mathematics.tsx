import "server-only";

import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import {
  type PublishedMaterialContent,
  type PublishedMaterialInput,
  readPublishedMaterial,
  renderPublishedMaterial,
} from "@/lib/content/published/material";

/** Renders one verified mathematics artifact through its physical registry. */
export async function renderPublishedMathematics(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return Effect.runPromise(
    renderPublishedMaterial({
      components: mathematicsComponents,
      data,
      rendererDomain: "mathematics",
    })
  );
}
