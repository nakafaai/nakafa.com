"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const KimPlusElectabilityChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/kim-plus/chart"
    ).then(({ ElectabilityChart }) => ElectabilityChart)
  )
);

export const PorkBarrelElectabilityChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/electability"
    ).then(({ ElectabilityChart }) => ElectabilityChart)
  )
);
