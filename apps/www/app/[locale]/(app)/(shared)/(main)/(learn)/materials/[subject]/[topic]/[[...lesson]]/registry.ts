import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { importAiDsMaterial } from "@repo/contents/_lib/material/ai-ds";
import { importBiologyMaterial } from "@repo/contents/_lib/material/biology";
import { importPhysicsMaterial } from "@repo/contents/_lib/material/physics";
import { aiDsComponents } from "@repo/design-system/lib/markdown/domain/ai-ds";
import { biologyComponents } from "@repo/design-system/lib/markdown/domain/biology";
import { physicsComponents } from "@repo/design-system/lib/markdown/domain/physics";
import { Either } from "effect";
import {
  MaterialRegistryMissingError,
  type MaterialRouteRuntime,
  type MaterialRuntimeResolution,
} from "@/lib/content/material";
import {
  renderPublishedAiDs,
  renderPublishedBiology,
  renderPublishedPhysics,
} from "@/lib/content/published/generic";

const aiDsRuntime = {
  components: aiDsComponents,
  importer: importAiDsMaterial,
  published: renderPublishedAiDs,
  rendererDomain: "ai-ds",
} satisfies MaterialRouteRuntime;

const biologyRuntime = {
  components: biologyComponents,
  importer: importBiologyMaterial,
  published: renderPublishedBiology,
  rendererDomain: "biology",
} satisfies MaterialRouteRuntime;

const physicsRuntime = {
  components: physicsComponents,
  importer: importPhysicsMaterial,
  published: renderPublishedPhysics,
  rendererDomain: "physics",
} satisfies MaterialRouteRuntime;

/**
 * Selects the exact statically imported registry for one generic material route.
 *
 * Next does not automatically code-split a dynamically imported Server
 * Component, so the physical route owns these three honest static imports.
 *
 * @see https://nextjs.org/docs/app/guides/lazy-loading#importing-server-components
 */
export function resolveGenericMaterialRuntime(
  rendererDomain: RendererDomain
): MaterialRuntimeResolution {
  if (rendererDomain === "ai-ds") {
    return Either.right(aiDsRuntime);
  }
  if (rendererDomain === "biology") {
    return Either.right(biologyRuntime);
  }
  if (rendererDomain === "physics") {
    return Either.right(physicsRuntime);
  }

  return Either.left(new MaterialRegistryMissingError({ rendererDomain }));
}
