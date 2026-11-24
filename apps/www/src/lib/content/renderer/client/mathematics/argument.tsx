"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ArgumentChainLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/argument/lab"
    ).then((module) => ({ default: module.ArgumentChainLab }))
  )
);
