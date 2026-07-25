import { BacterialGrowth } from "@repo/design-system/components/contents/mathematics/animation-bacterial";
import {
  BarChart,
  HistogramChart,
} from "@repo/design-system/components/contents/mathematics/bar-chart";
import { VirusChart as FunctionExplorationVirusChart } from "@repo/design-system/components/contents/mathematics/exponential/virus-chart";
import {
  Diagram as FunctionAndNonFunctionDiagram,
  RelationVisualizer as FunctionAndNonFunctionRelationVisualizer,
} from "@repo/design-system/components/contents/mathematics/function/diagram";
import { FunctionIllustration as InverseFunctionIllustration } from "@repo/design-system/components/contents/mathematics/function/illustration";
import { FunctionChart } from "@repo/design-system/components/contents/mathematics/function-chart";
import { FunctionMachine } from "@repo/design-system/components/contents/mathematics/function-machine";
import { Inequality } from "@repo/design-system/components/contents/mathematics/inequality";
import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { ReadingRoomProblem as QuadraticEquationReadingRoomProblem } from "@repo/design-system/components/contents/mathematics/quadratic/reading-room";
import { ScatterDiagram } from "@repo/design-system/components/contents/mathematics/scatter-diagram";
import SequenceConceptTableChairsAnimation from "@repo/design-system/components/contents/mathematics/sequence/animation";
import { Triangle } from "@repo/design-system/components/contents/mathematics/triangle";
import { UnitCircle } from "@repo/design-system/components/contents/mathematics/unit-circle";
import { Vector3d } from "@repo/design-system/components/contents/mathematics/vector-3d";
import { VectorChart } from "@repo/design-system/components/contents/mathematics/vector-chart";
import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by mathematics routes. */
export const mathematicsRegistry = {
  [mathematicsComponentNames.bacterialGrowth]: BacterialGrowth,
  [mathematicsComponentNames.barChart]: BarChart,
  [mathematicsComponentNames.functionAndNonFunctionDiagram]:
    FunctionAndNonFunctionDiagram,
  [mathematicsComponentNames.functionAndNonFunctionRelationVisualizer]:
    FunctionAndNonFunctionRelationVisualizer,
  [mathematicsComponentNames.functionChart]: FunctionChart,
  [mathematicsComponentNames.functionExplorationVirusChart]:
    FunctionExplorationVirusChart,
  [mathematicsComponentNames.functionMachine]: FunctionMachine,
  [mathematicsComponentNames.histogramChart]: HistogramChart,
  [mathematicsComponentNames.inequality]: Inequality,
  [mathematicsComponentNames.inverseFunctionIllustration]:
    InverseFunctionIllustration,
  [mathematicsComponentNames.lineEquation]: LineEquation,
  [mathematicsComponentNames.quadraticEquationReadingRoomProblem]:
    QuadraticEquationReadingRoomProblem,
  [mathematicsComponentNames.scatterDiagram]: ScatterDiagram,
  [mathematicsComponentNames.sequenceConceptTableChairsAnimation]:
    SequenceConceptTableChairsAnimation,
  [mathematicsComponentNames.triangle]: Triangle,
  [mathematicsComponentNames.unitCircle]: UnitCircle,
  [mathematicsComponentNames.vector3d]: Vector3d,
  [mathematicsComponentNames.vectorChart]: VectorChart,
} satisfies MDXComponents;

/** Complete renderer used only by mathematics routes. */
export const mathematicsComponents: MDXComponents = {
  ...mdxComponents,
  ...mathematicsRegistry,
};
