import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  HistogramChart,
  LineEquation,
  NumberLine,
} from "@/lib/content/renderer/client/tka/basics";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: tkaMathComponentNames.histogramChart,
    component: HistogramChart,
  },
  {
    name: tkaMathComponentNames.lineEquation,
    component: LineEquation,
  },
  {
    name: tkaMathComponentNames.numberLine,
    component: NumberLine,
  },
] satisfies readonly RendererImplementation[];
