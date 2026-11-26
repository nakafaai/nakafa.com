"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AtomEconomyReactorLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/economy/lab"
    ).then((module) => ({ default: module.AtomEconomyReactorLab }))
  )
);

export const GreenCatalystCycleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/recovery/lab"
    ).then((module) => ({ default: module.GreenCatalystCycleLab }))
  )
);
