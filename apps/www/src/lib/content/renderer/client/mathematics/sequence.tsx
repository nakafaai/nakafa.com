"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SequenceConceptTableChairsAnimation = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/sequence/animation"
    ).then((module) => ({ default: module.default }))
  )
);
