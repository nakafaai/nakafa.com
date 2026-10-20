import { aiDsComponentNames } from "@repo/design-system/lib/markdown/names";
import { LineEquation } from "@/lib/content/renderer/client/ai/equation";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: aiDsComponentNames.lineEquation,
    component: LineEquation,
  },
] satisfies readonly RendererImplementation[];
