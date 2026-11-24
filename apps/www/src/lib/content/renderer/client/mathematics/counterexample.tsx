"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CounterexampleGridLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/counterexample/lab"
    ).then((module) => ({ default: module.CounterexampleGridLab }))
  )
);
