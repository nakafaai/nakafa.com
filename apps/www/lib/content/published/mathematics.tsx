import "server-only";

import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import type { PublishedMaterialContent } from "@/lib/content/material";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/exchange";
import { renderPublishedMaterial } from "@/lib/content/published/material";

/** Renders one verified mathematics artifact through its physical registry. */
export async function renderPublishedMathematics(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  applyPublishedContentCache();
  const data = await Effect.runPromise(readPublishedMaterial(input));

  return Effect.runPromise(
    renderPublishedMaterial({
      components: mathematicsComponents,
      data,
      rendererDomain: "mathematics",
    })
  );
}
