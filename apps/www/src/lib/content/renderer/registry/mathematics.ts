import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  BarChart,
  Chart,
  FunctionChart,
  HistogramChart,
  ScatterDiagram,
} from "@/lib/content/renderer/client/mathematics/charts";
import {
  LineEquation,
  QuadraticEquationReadingRoomProblem,
} from "@/lib/content/renderer/client/mathematics/equation";
import {
  FunctionAndNonFunctionDiagram,
  FunctionAndNonFunctionRelationVisualizer,
  FunctionMachine,
  InverseFunctionIllustration,
} from "@/lib/content/renderer/client/mathematics/function";
import { UnitCircle } from "@/lib/content/renderer/client/mathematics/geometry";
import {
  BacterialGrowth,
  FunctionExplorationVirusChart,
} from "@/lib/content/renderer/client/mathematics/growth";
import { NumberLine } from "@/lib/content/renderer/client/mathematics/number";
import { SequenceConceptTableChairsAnimation } from "@/lib/content/renderer/client/mathematics/sequence";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every mathematics visual, which any lesson in any domain may use. */
export const mathematicsRenderers = [
  {
    name: mathematicsComponentNames.bacterialGrowth,
    component: BacterialGrowth,
  },
  {
    name: mathematicsComponentNames.barChart,
    component: BarChart,
  },
  {
    name: mathematicsComponentNames.chart,
    component: Chart,
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionDiagram,
    component: FunctionAndNonFunctionDiagram,
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionRelationVisualizer,
    component: FunctionAndNonFunctionRelationVisualizer,
  },
  {
    name: mathematicsComponentNames.functionChart,
    component: FunctionChart,
  },
  {
    name: mathematicsComponentNames.functionExplorationVirusChart,
    component: FunctionExplorationVirusChart,
  },
  {
    name: mathematicsComponentNames.functionMachine,
    component: FunctionMachine,
  },
  {
    name: mathematicsComponentNames.histogramChart,
    component: HistogramChart,
  },
  {
    name: mathematicsComponentNames.inverseFunctionIllustration,
    component: InverseFunctionIllustration,
  },
  {
    name: mathematicsComponentNames.lineEquation,
    component: LineEquation,
  },
  {
    name: mathematicsComponentNames.numberLine,
    component: NumberLine,
  },
  {
    name: mathematicsComponentNames.quadraticEquationReadingRoomProblem,
    component: QuadraticEquationReadingRoomProblem,
  },
  {
    name: mathematicsComponentNames.scatterDiagram,
    component: ScatterDiagram,
  },
  {
    name: mathematicsComponentNames.sequenceConceptTableChairsAnimation,
    component: SequenceConceptTableChairsAnimation,
  },
  {
    name: mathematicsComponentNames.unitCircle,
    component: UnitCircle,
  },
] satisfies readonly RendererImplementation[];
