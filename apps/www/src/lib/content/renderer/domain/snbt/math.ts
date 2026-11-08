import { snbtMathComponentNames } from "@repo/design-system/lib/markdown/names";
import { NumberLine } from "@/lib/content/renderer/client/snbt/math/number";
import { LineEquationServer } from "@/lib/content/renderer/line.server";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: snbtMathComponentNames.lineEquation,
    component: LineEquationServer,
  },
  {
    name: snbtMathComponentNames.numberLine,
    component: NumberLine,
  },
] satisfies readonly RendererImplementation[];
