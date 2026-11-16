"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const QuadraticEquationReadingRoomProblem = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/quadratic/room"
    ).then((module) => ({ default: module.ReadingRoomProblem }))
  )
);
