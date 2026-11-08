import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import { NumberLine } from "@/lib/content/renderer/client/snbt/math/number";
import { UnitCircle } from "@/lib/content/renderer/client/snbt/quant/basics";
import { LineEquationServer } from "@/lib/content/renderer/line.server";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: snbtQuantComponentNames.lineEquation,
    component: LineEquationServer,
  },
  {
    name: snbtQuantComponentNames.numberLine,
    component: NumberLine,
  },
  {
    name: snbtQuantComponentNames.unitCircle,
    component: UnitCircle,
  },
] satisfies readonly RendererImplementation[];
