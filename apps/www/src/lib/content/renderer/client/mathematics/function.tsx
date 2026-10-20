"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const InverseFunctionIllustration = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/illustration"
    ).then(({ FunctionIllustration }) => FunctionIllustration)
  )
);

export const FunctionAndNonFunctionDiagram = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then(({ Diagram }) => Diagram)
  )
);

export const FunctionAndNonFunctionRelationVisualizer = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then(({ RelationVisualizer }) => RelationVisualizer)
  )
);

export const FunctionMachine = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function-machine"
    ).then(({ FunctionMachine }) => FunctionMachine)
  )
);
