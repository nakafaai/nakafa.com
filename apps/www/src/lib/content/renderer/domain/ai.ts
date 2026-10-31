import { aiDsComponentNames } from "@repo/design-system/lib/markdown/names";
import { LineEquationServer } from "@/lib/content/renderer/line.server";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: aiDsComponentNames.lineEquation,
    component: LineEquationServer,
  },
] satisfies readonly RendererImplementation[];
