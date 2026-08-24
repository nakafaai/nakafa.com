import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: mathematicsComponentNames.bacterialGrowth,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyBacterialGrowth }) => LazyBacterialGrowth
      ),
  },
  {
    name: mathematicsComponentNames.barChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyBarChart }) => LazyBarChart
      ),
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionDiagram,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyFunctionAndNonFunctionDiagram }) =>
          LazyFunctionAndNonFunctionDiagram
      ),
  },
  {
    name: mathematicsComponentNames.functionAndNonFunctionRelationVisualizer,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyFunctionAndNonFunctionRelationVisualizer }) =>
          LazyFunctionAndNonFunctionRelationVisualizer
      ),
  },
  {
    name: mathematicsComponentNames.functionChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyFunctionChart }) => LazyFunctionChart
      ),
  },
  {
    name: mathematicsComponentNames.functionExplorationVirusChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyFunctionExplorationVirusChart }) =>
          LazyFunctionExplorationVirusChart
      ),
  },
  {
    name: mathematicsComponentNames.functionMachine,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyFunctionMachine }) => LazyFunctionMachine
      ),
  },
  {
    name: mathematicsComponentNames.histogramChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyHistogramChart }) => LazyHistogramChart
      ),
  },
  {
    name: mathematicsComponentNames.inequality,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/inequality"
      ).then(({ Inequality }) => Inequality),
  },
  {
    name: mathematicsComponentNames.inverseFunctionIllustration,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/function/illustration"
      ).then(({ FunctionIllustration }) => FunctionIllustration),
  },
  {
    name: mathematicsComponentNames.lineEquation,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/line-equation"
      ).then(({ LineEquation }) => LineEquation),
  },
  {
    name: mathematicsComponentNames.quadraticEquationReadingRoomProblem,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
      ).then(({ ReadingRoomProblem }) => ReadingRoomProblem),
  },
  {
    name: mathematicsComponentNames.scatterDiagram,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyScatterDiagram }) => LazyScatterDiagram
      ),
  },
  {
    name: mathematicsComponentNames.sequenceConceptTableChairsAnimation,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazySequenceConceptTableChairsAnimation }) =>
          LazySequenceConceptTableChairsAnimation
      ),
  },
  {
    name: mathematicsComponentNames.triangle,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyTriangle }) => LazyTriangle
      ),
  },
  {
    name: mathematicsComponentNames.unitCircle,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyUnitCircle }) => LazyUnitCircle
      ),
  },
  {
    name: mathematicsComponentNames.vector3d,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/vector-3d"
      ).then(({ Vector3d }) => Vector3d),
  },
  {
    name: mathematicsComponentNames.vectorChart,
    load: () =>
      import("@/lib/content/renderer/client/mathematics").then(
        ({ LazyVectorChart }) => LazyVectorChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
