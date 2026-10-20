"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Inequality = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/inequality"
    ).then((module) => ({ default: module.Inequality }))
  )
);

export const LineEquation = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then((module) => ({ default: module.LineEquation }))
  )
);

export const QuadraticEquationReadingRoomProblem = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
    ).then((module) => ({ default: module.ReadingRoomProblem }))
  )
);
