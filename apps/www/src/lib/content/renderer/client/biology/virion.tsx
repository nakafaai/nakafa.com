"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SarsCov2VirionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/sars-cov-2-virion"
    ).then((module) => ({ default: module.SarsCov2VirionLab }))
  )
);
