"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DimensionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/dimension/lab"
    ).then((module) => ({ default: module.DimensionLab }))
  )
);

export const MeasurementToolsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/tools/lab"
    ).then((module) => ({ default: module.MeasurementToolsLab }))
  )
);
