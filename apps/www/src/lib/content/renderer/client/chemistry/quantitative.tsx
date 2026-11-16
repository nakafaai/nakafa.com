"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const TitrationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/titration/lab"
    ).then((module) => ({ default: module.TitrationLab }))
  )
);

export const GasRateLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/rate/lab").then(
      (module) => ({ default: module.GasRateLab })
    )
  )
);
