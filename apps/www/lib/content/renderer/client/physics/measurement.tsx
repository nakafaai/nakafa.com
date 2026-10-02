"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DimensionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/dimension/lab"
    ).then(({ DimensionLab }) => DimensionLab)
  )
);

export const MeasurementToolsLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/tools/lab"
    ).then(({ MeasurementToolsLab }) => MeasurementToolsLab)
  )
);
