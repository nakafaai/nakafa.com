import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: mathematicsComponentNames.bacterialGrowth,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/growth").then(
        ({ BacterialGrowth }) => BacterialGrowth
      ),
  },
  {
    name: mathematicsComponentNames.barChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/charts").then(
        ({ BarChart }) => BarChart
      ),
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionDiagram,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/function").then(
        ({ FunctionAndNonFunctionDiagram }) => FunctionAndNonFunctionDiagram
      ),
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionRelationVisualizer,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/function").then(
        ({ FunctionAndNonFunctionRelationVisualizer }) =>
          FunctionAndNonFunctionRelationVisualizer
      ),
  },
  {
    name: mathematicsComponentNames.functionChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/charts").then(
        ({ FunctionChart }) => FunctionChart
      ),
  },
  {
    name: mathematicsComponentNames.functionExplorationVirusChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/growth").then(
        ({ FunctionExplorationVirusChart }) => FunctionExplorationVirusChart
      ),
  },
  {
    name: mathematicsComponentNames.functionMachine,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/function").then(
        ({ FunctionMachine }) => FunctionMachine
      ),
  },
  {
    name: mathematicsComponentNames.histogramChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/charts").then(
        ({ HistogramChart }) => HistogramChart
      ),
  },
  {
    name: mathematicsComponentNames.inequality,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/equation").then(
        ({ Inequality }) => Inequality
      ),
  },
  {
    name: mathematicsComponentNames.inverseFunctionIllustration,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/function").then(
        ({ InverseFunctionIllustration }) => InverseFunctionIllustration
      ),
  },
  {
    name: mathematicsComponentNames.lineEquation,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/equation").then(
        ({ LineEquation }) => LineEquation
      ),
  },
  {
    name: mathematicsComponentNames.quadraticEquationReadingRoomProblem,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/equation").then(
        ({ QuadraticEquationReadingRoomProblem }) =>
          QuadraticEquationReadingRoomProblem
      ),
  },
  {
    name: mathematicsComponentNames.scatterDiagram,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/charts").then(
        ({ ScatterDiagram }) => ScatterDiagram
      ),
  },
  {
    name: mathematicsComponentNames.sequenceConceptTableChairsAnimation,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/sequence").then(
        ({ SequenceConceptTableChairsAnimation }) =>
          SequenceConceptTableChairsAnimation
      ),
  },
  {
    name: mathematicsComponentNames.triangle,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/geometry").then(
        ({ Triangle }) => Triangle
      ),
  },
  {
    name: mathematicsComponentNames.unitCircle,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/geometry").then(
        ({ UnitCircle }) => UnitCircle
      ),
  },
  {
    name: mathematicsComponentNames.vector3d,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/vector").then(
        ({ Vector3d }) => Vector3d
      ),
  },
  {
    name: mathematicsComponentNames.vectorChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics/charts").then(
        ({ VectorChart }) => VectorChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
