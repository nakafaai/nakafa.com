"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BloodTypingLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/blood/lab").then(
      (module) => ({ default: module.BloodTypingLab })
    )
  )
);

export const CapillaryBedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/capillary/lab"
    ).then((module) => ({ default: module.CapillaryBedLab }))
  )
);

export const HeartCycleLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/heart/lab").then(
      (module) => ({ default: module.HeartCycleLab })
    )
  )
);
