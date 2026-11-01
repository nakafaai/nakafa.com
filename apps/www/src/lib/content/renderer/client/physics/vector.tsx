"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VectorConceptLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/concept/lab"
    ).then((module) => ({ default: module.VectorConceptLab }))
  )
);
