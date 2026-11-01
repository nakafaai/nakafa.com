"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Triangle = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/mathematics/triangle").then(
      (module) => ({ default: module.Triangle })
    )
  )
);

export const UnitCircle = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/unit-circle"
    ).then((module) => ({ default: module.UnitCircle }))
  )
);
