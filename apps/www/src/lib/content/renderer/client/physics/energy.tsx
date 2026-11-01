"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const WindEnergyConversionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
    ).then((module) => ({ default: module.WindEnergyConversionLab }))
  )
);
