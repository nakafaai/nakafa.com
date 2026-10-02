import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { aiDsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: aiDsComponentNames.lineEquation,
    component: LineEquation,
  },
] satisfies readonly RendererImplementation[];
