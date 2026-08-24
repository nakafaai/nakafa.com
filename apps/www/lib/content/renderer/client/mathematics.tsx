"use client";

import dynamic from "next/dynamic";

export const LazyBacterialGrowth = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/animation-bacterial"
  ).then(({ BacterialGrowth }) => BacterialGrowth)
);
export const LazyBarChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ BarChart }) => BarChart
  )
);
export const LazyHistogramChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ HistogramChart }) => HistogramChart
  )
);
export const LazyFunctionExplorationVirusChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
  ).then(({ VirusChart }) => VirusChart)
);
export const LazyFunctionAndNonFunctionDiagram = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function/diagram"
  ).then(({ Diagram }) => Diagram)
);
export const LazyFunctionAndNonFunctionRelationVisualizer = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function/diagram"
  ).then(({ RelationVisualizer }) => RelationVisualizer)
);
export const LazyFunctionChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function-chart"
  ).then(({ FunctionChart }) => FunctionChart)
);
export const LazyFunctionMachine = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function-machine"
  ).then(({ FunctionMachine }) => FunctionMachine)
);
export const LazyScatterDiagram = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/scatter-diagram"
  ).then(({ ScatterDiagram }) => ScatterDiagram)
);
export const LazySequenceConceptTableChairsAnimation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/sequence/animation"
  ).then(({ default: Animation }) => Animation)
);
export const LazyTriangle = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/triangle").then(
    ({ Triangle }) => Triangle
  )
);
export const LazyUnitCircle = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/unit-circle"
  ).then(({ UnitCircle }) => UnitCircle)
);
export const LazyVectorChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/vector-chart"
  ).then(({ VectorChart }) => VectorChart)
);
