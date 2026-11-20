import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  DiceRollLab,
  GaltonBoardLab,
  MarbleDrawLab,
} from "@/lib/content/renderer/client/mathematics/chance";
import {
  BarChart,
  Chart,
  FunctionChart,
  HistogramChart,
  ScatterDiagram,
} from "@/lib/content/renderer/client/mathematics/charts";
import { QuadraticEquationReadingRoomProblem } from "@/lib/content/renderer/client/mathematics/equation";
import {
  FunctionAndNonFunctionDiagram,
  FunctionAndNonFunctionRelationVisualizer,
  FunctionMachine,
  InverseFunctionIllustration,
} from "@/lib/content/renderer/client/mathematics/function";
import {
  BacterialGrowth,
  FunctionExplorationVirusChart,
} from "@/lib/content/renderer/client/mathematics/growth";
import {
  AbacusBaseLab,
  BinaryLampLab,
} from "@/lib/content/renderer/client/mathematics/numeral";
import { SequenceConceptTableChairsAnimation } from "@/lib/content/renderer/client/mathematics/sequence";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every mathematics visual, which any lesson in any domain may use. */
export const mathematicsRenderers = [
  {
    name: mathematicsComponentNames.abacusBaseLab,
    component: AbacusBaseLab,
  },
  {
    name: mathematicsComponentNames.bacterialGrowth,
    component: BacterialGrowth,
  },
  {
    name: mathematicsComponentNames.barChart,
    component: BarChart,
  },
  {
    name: mathematicsComponentNames.binaryLampLab,
    component: BinaryLampLab,
  },
  {
    name: mathematicsComponentNames.chart,
    component: Chart,
  },
  {
    name: mathematicsComponentNames.diceRollLab,
    component: DiceRollLab,
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
    name: mathematicsComponentNames.galtonBoardLab,
    component: GaltonBoardLab,
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
    name: mathematicsComponentNames.marbleDrawLab,
    component: MarbleDrawLab,
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
] satisfies readonly RendererImplementation[];
