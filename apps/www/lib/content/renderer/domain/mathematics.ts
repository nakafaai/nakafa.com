import { Triangle } from "@repo/design-system/components/contents/mathematics/triangle";
import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  BarChart,
  FunctionChart,
  HistogramChart,
  ScatterDiagram,
  VectorChart,
} from "@/lib/content/renderer/client/mathematics/charts";
import {
  Inequality,
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
import { SequenceConceptTableChairsAnimation } from "@/lib/content/renderer/client/mathematics/sequence";
import { Vector3d } from "@/lib/content/renderer/client/mathematics/vector";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: mathematicsComponentNames.bacterialGrowth,
    component: BacterialGrowth,
  },
  {
    name: mathematicsComponentNames.barChart,
    component: BarChart,
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
    name: mathematicsComponentNames.inequality,
    component: Inequality,
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
    name: mathematicsComponentNames.triangle,
    component: Triangle,
  },
  {
    name: mathematicsComponentNames.unitCircle,
    component: UnitCircle,
  },
  {
    name: mathematicsComponentNames.vector3d,
    component: Vector3d,
  },
  {
    name: mathematicsComponentNames.vectorChart,
    component: VectorChart,
  },
] satisfies readonly RendererImplementation[];
