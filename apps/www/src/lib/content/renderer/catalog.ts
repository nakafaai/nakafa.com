import type { Option } from "effect";
import { Array as Arr } from "effect";
import { baseRenderers } from "@/lib/content/renderer/registry/base";
import { biologyRenderers } from "@/lib/content/renderer/registry/biology";
import { botanyRenderers } from "@/lib/content/renderer/registry/botany";
import { chemistryRenderers } from "@/lib/content/renderer/registry/chemistry";
import { circuitRenderers } from "@/lib/content/renderer/registry/circuit";
import { electronicsRenderers } from "@/lib/content/renderer/registry/electronics";
import { fieldRenderers } from "@/lib/content/renderer/registry/field";
import { fluidRenderers } from "@/lib/content/renderer/registry/fluid";
import { geneticsRenderers } from "@/lib/content/renderer/registry/genetics";
import { gravityRenderers } from "@/lib/content/renderer/registry/gravity";
import { heatRenderers } from "@/lib/content/renderer/registry/heat";
import { mathematicsRenderers } from "@/lib/content/renderer/registry/mathematics";
import { measureRenderers } from "@/lib/content/renderer/registry/measure";
import { mechanicsRenderers } from "@/lib/content/renderer/registry/mechanics";
import { nuclearRenderers } from "@/lib/content/renderer/registry/nuclear";
import { opticsRenderers } from "@/lib/content/renderer/registry/optics";
import { physicsRenderers } from "@/lib/content/renderer/registry/physics";
import { politicsRenderers } from "@/lib/content/renderer/registry/politics";
import { synthesisRenderers } from "@/lib/content/renderer/registry/synthesis";
import { wavesRenderers } from "@/lib/content/renderer/registry/waves";
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
  ...botanyRenderers,
  ...geneticsRenderers,
  ...chemistryRenderers,
  ...synthesisRenderers,
  ...mathematicsRenderers,
  ...physicsRenderers,
  ...circuitRenderers,
  ...electronicsRenderers,
  ...fieldRenderers,
  ...fluidRenderers,
  ...gravityRenderers,
  ...heatRenderers,
  ...measureRenderers,
  ...mechanicsRenderers,
  ...nuclearRenderers,
  ...opticsRenderers,
  ...wavesRenderers,
  ...politicsRenderers,
] satisfies readonly RendererImplementation[];

/** Finds the renderer of one catalog component by its name. */
export function catalogRenderer(
  name: string
): Option.Option<RendererImplementation> {
  return Arr.findFirst(catalogRenderers, (renderer) => renderer.name === name);
}
