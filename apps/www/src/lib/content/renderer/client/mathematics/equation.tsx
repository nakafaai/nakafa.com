"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Inequality = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/inequality"
    ).then(({ Inequality: Component }) => Component)
  )
);

export const LineEquation = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then(({ LineEquation: Component }) => Component)
  )
);

export const QuadraticEquationReadingRoomProblem = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/quadratic/reading-room"
    ).then(({ ReadingRoomProblem }) => ReadingRoomProblem)
  )
);
