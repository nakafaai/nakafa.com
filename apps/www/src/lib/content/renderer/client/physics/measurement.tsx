"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DimensionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/measurement/dimension/lab"
      ).then(({ DimensionLab }) => DimensionLab))(),
  }))
);

export const MeasurementToolsLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/measurement/tools/lab"
      ).then(({ MeasurementToolsLab }) => MeasurementToolsLab))(),
  }))
);
