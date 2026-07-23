import "server-only";

import { chemistryComponents } from "@repo/design-system/lib/markdown/domain/chemistry";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import type { PublishedMaterialContent } from "@/lib/content/material";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
} from "@/lib/content/published/exchange";
import { renderPublishedMaterial } from "@/lib/content/published/material";

/** Renders one verified chemistry artifact through its physical registry. */
export async function renderPublishedChemistry(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  applyPublishedContentCache();
  const data = await Effect.runPromise(readPublishedMaterial(input));

  return Effect.runPromise(
    renderPublishedMaterial({
      components: chemistryComponents,
      data,
      rendererDomain: "chemistry",
    })
  );
}
