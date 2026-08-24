import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: tkaMathComponentNames.histogramChart,
    load: () =>
      import("@/lib/content/renderer/client/tka/basics").then(
        ({ HistogramChart }) => HistogramChart
      ),
  },
  {
    name: tkaMathComponentNames.lineEquation,
    load: () =>
      import("@/lib/content/renderer/client/tka/basics").then(
        ({ LineEquation }) => LineEquation
      ),
  },
  {
    name: tkaMathComponentNames.numberLine,
    load: () =>
      import("@/lib/content/renderer/client/tka/basics").then(
        ({ NumberLine }) => NumberLine
      ),
  },
  {
    name: tkaMathComponentNames.set1Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/tka/set1").then(
        ({ Set1Question19Graph }) => Set1Question19Graph
      ),
  },
  {
    name: tkaMathComponentNames.set1Question30Illustration,
    load: () =>
      import("@/lib/content/renderer/client/tka/set1").then(
        ({ Set1Question30Illustration }) => Set1Question30Illustration
      ),
  },
] satisfies readonly RendererComponentLoader[];
