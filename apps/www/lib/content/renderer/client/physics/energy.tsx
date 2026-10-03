"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const WindEnergyConversionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
    ).then(({ WindEnergyConversionLab }) => WindEnergyConversionLab)
  )
);
