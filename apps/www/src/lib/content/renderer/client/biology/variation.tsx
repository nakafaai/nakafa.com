"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChromosomeMutationLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/mutation/lab").then(
      (module) => ({ default: module.ChromosomeMutationLab })
    )
  )
);

export const MeiosisShufflingLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/meiosis/lab").then(
      (module) => ({ default: module.MeiosisShufflingLab })
    )
  )
);

export const VariationDistributionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/variation/lab"
    ).then((module) => ({ default: module.VariationDistributionLab }))
  )
);
