import { HistogramChart } from "@repo/design-system/components/contents/mathematics/bar-chart";
import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { NumberLine } from "@repo/design-system/components/contents/mathematics/number-line";
import { Graph as Set1Question19Graph } from "@repo/design-system/components/contents/tka/mathematics/set-1/question-19";
import { Illustration as Set1Question30Illustration } from "@repo/design-system/components/contents/tka/mathematics/set-1/question-30";
import { tkaMathComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by TKA mathematics routes. */
export const tkaMathRegistry = {
  [tkaMathComponentNames.histogramChart]: HistogramChart,
  [tkaMathComponentNames.lineEquation]: LineEquation,
  [tkaMathComponentNames.numberLine]: NumberLine,
  [tkaMathComponentNames.set1Question19Graph]: Set1Question19Graph,
  [tkaMathComponentNames.set1Question30Illustration]:
    Set1Question30Illustration,
} satisfies MDXComponents;

/** Complete renderer used only by TKA mathematics routes. */
export const tkaMathComponents: MDXComponents = {
  ...mdxComponents,
  ...tkaMathRegistry,
};
