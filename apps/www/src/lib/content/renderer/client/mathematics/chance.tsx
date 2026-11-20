"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DiceRollLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/mathematics/dice/lab").then(
      (module) => ({ default: module.DiceRollLab })
    )
  )
);

export const GaltonBoardLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/galton/lab"
    ).then((module) => ({ default: module.GaltonBoardLab }))
  )
);

export const MarbleDrawLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/marble/lab"
    ).then((module) => ({ default: module.MarbleDrawLab }))
  )
);
