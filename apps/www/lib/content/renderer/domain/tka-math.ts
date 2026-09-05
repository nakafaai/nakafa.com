import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  HistogramChart,
  LineEquation,
  NumberLine,
} from "@/lib/content/renderer/client/tka/basics";
import {
  Set1Question19Graph,
  Set1Question30Illustration,
} from "@/lib/content/renderer/client/tka/set1";
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
  {
    name: tkaMathComponentNames.set1Question19Graph,
    component: Set1Question19Graph,
  },
  {
    name: tkaMathComponentNames.set1Question30Illustration,
    component: Set1Question30Illustration,
  },
] satisfies readonly RendererImplementation[];
