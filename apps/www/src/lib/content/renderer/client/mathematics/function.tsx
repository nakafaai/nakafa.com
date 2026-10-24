"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const InverseFunctionIllustration = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/illustration"
    ).then((module) => ({ default: module.FunctionIllustration }))
  )
);

export const FunctionAndNonFunctionDiagram = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then((module) => ({ default: module.Diagram }))
  )
);

export const FunctionAndNonFunctionRelationVisualizer = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function/diagram"
    ).then((module) => ({ default: module.RelationVisualizer }))
  )
);

export const FunctionMachine = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/function-machine"
    ).then((module) => ({ default: module.FunctionMachine }))
  )
);
