"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const InverseFunctionIllustration = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/illustration"
    ).then(({ FunctionIllustration }) => FunctionIllustration)
  )
);

export const FunctionAndNonFunctionDiagram = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then(({ Diagram }) => Diagram)
  )
);

export const FunctionAndNonFunctionRelationVisualizer = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then(({ RelationVisualizer }) => RelationVisualizer)
  )
);

export const FunctionMachine = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function-machine"
    ).then(({ FunctionMachine }) => FunctionMachine)
  )
);
