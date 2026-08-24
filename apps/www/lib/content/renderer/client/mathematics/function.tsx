"use client";

import dynamic from "next/dynamic";

export const InverseFunctionIllustration = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function/illustration"
  ).then(({ FunctionIllustration }) => FunctionIllustration)
);

export const FunctionAndNonFunctionDiagram = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function/diagram"
  ).then(({ Diagram }) => Diagram)
);

export const FunctionAndNonFunctionRelationVisualizer = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function/diagram"
  ).then(({ RelationVisualizer }) => RelationVisualizer)
);

export const FunctionMachine = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function-machine"
  ).then(({ FunctionMachine }) => FunctionMachine)
);
