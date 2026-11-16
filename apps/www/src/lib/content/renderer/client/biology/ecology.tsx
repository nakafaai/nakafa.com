"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PredatorPreyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/ecosystem/meadow"
    ).then((module) => ({ default: module.PredatorPreyLab }))
  )
);
