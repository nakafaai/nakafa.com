import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  HistogramChart,
  NumberLine,
} from "@/lib/content/renderer/client/tka/basics";
import { LineEquationServer } from "@/lib/content/renderer/line.server";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: tkaMathComponentNames.histogramChart,
    component: HistogramChart,
  },
  {
    name: tkaMathComponentNames.lineEquation,
    component: LineEquationServer,
  },
  {
    name: tkaMathComponentNames.numberLine,
    component: NumberLine,
  },
] satisfies readonly RendererImplementation[];
