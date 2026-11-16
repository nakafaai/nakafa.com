import { Array as Arr, type Option } from "effect";
import { baseRenderers } from "@/lib/content/renderer/registry/base";
import { biologyRenderers } from "@/lib/content/renderer/registry/biology";
import { chemistryRenderers } from "@/lib/content/renderer/registry/chemistry";
import { mathematicsRenderers } from "@/lib/content/renderer/registry/mathematics";
import { physicsRenderers } from "@/lib/content/renderer/registry/physics";
import { politicsRenderers } from "@/lib/content/renderer/registry/politics";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/**
 * Every component of the Visual Catalog as the browser draws it, each loading
 * its own code when a page first shows it. A lesson and an assessment draw from
 * this one list; a lesson built on the server swaps in its server renderers
 * (`selection.ts`).
 */
export const catalogRenderers = [
  ...baseRenderers,
  ...biologyRenderers,
  ...chemistryRenderers,
  ...mathematicsRenderers,
  ...physicsRenderers,
  ...politicsRenderers,
] satisfies readonly RendererImplementation[];

/** Finds the renderer of one catalog component by its name. */
export function catalogRenderer(
  name: string
): Option.Option<RendererImplementation> {
  return Arr.findFirst(catalogRenderers, (renderer) => renderer.name === name);
}
