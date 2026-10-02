"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Inequality = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/inequality"
    ).then(({ Inequality: Component }) => Component)
  )
);

export const LineEquation = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then(({ LineEquation: Component }) => Component)
  )
);

export const QuadraticEquationReadingRoomProblem = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
    ).then(({ ReadingRoomProblem }) => ReadingRoomProblem)
  )
);
