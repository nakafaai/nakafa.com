import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: tkaMathComponentNames.histogramChart,
    load: () =>
      import("@/lib/content/renderer/client/tka-math").then(
        ({ LazyHistogramChart }) => LazyHistogramChart
      ),
  },
  {
    name: tkaMathComponentNames.lineEquation,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/line-equation"
      ).then(({ LineEquation }) => LineEquation),
  },
  {
    name: tkaMathComponentNames.numberLine,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/number-line"
      ).then(({ NumberLine }) => NumberLine),
  },
  {
    name: tkaMathComponentNames.set1Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/tka-math").then(
        ({ LazySet1Question19Graph }) => LazySet1Question19Graph
      ),
  },
  {
    name: tkaMathComponentNames.set1Question30Illustration,
    load: () =>
      import(
        "@repo/design-system/components/contents/tka/mathematics/set-1/question-30"
      ).then(({ Illustration }) => Illustration),
  },
] satisfies readonly RendererComponentLoader[];
