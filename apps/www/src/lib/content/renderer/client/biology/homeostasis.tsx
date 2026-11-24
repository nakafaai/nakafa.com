"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BloodGlucoseFeedbackLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/glucose/lab").then(
      (module) => ({ default: module.BloodGlucoseFeedbackLab })
    )
  )
);

export const ThermoregulationSkinLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/skin/lab").then(
      (module) => ({ default: module.ThermoregulationSkinLab })
    )
  )
);
