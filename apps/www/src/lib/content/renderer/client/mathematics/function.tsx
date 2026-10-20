"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const InverseFunctionIllustration = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/function/illustration"
      ).then(({ FunctionIllustration }) => FunctionIllustration))(),
  }))
);

export const FunctionAndNonFunctionDiagram = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/function/diagram"
      ).then(({ Diagram }) => Diagram))(),
  }))
);

export const FunctionAndNonFunctionRelationVisualizer = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/function/diagram"
      ).then(({ RelationVisualizer }) => RelationVisualizer))(),
  }))
);

export const FunctionMachine = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/function-machine"
      ).then(({ FunctionMachine }) => FunctionMachine))(),
  }))
);
