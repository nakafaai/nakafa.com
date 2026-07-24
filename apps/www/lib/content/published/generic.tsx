import "server-only";

import { aiDsComponents } from "@repo/design-system/lib/markdown/domain/ai-ds";
import { biologyComponents } from "@repo/design-system/lib/markdown/domain/biology";
import { physicsComponents } from "@repo/design-system/lib/markdown/domain/physics";
import { Effect } from "effect";
import { applyPublishedContentCache } from "@/lib/content/cache";
import type { PublishedMaterialContent } from "@/lib/content/material";
import {
  type PublishedMaterialInput,
  readPublishedMaterial,
  renderPublishedMaterial,
} from "@/lib/content/published/material";

/** Renders one verified AI and data-science artifact through its exact registry. */
export async function renderPublishedAiDs(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return Effect.runPromise(
    renderPublishedMaterial({
      components: aiDsComponents,
      data,
      rendererDomain: "ai-ds",
    })
  );
}

/** Renders one verified biology artifact through its exact registry. */
export async function renderPublishedBiology(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return Effect.runPromise(
    renderPublishedMaterial({
      components: biologyComponents,
      data,
      rendererDomain: "biology",
    })
  );
}

/** Renders one verified physics artifact through its exact registry. */
export async function renderPublishedPhysics(
  input: PublishedMaterialInput
): Promise<PublishedMaterialContent> {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);

  return Effect.runPromise(
    renderPublishedMaterial({
      components: physicsComponents,
      data,
      rendererDomain: "physics",
    })
  );
}
