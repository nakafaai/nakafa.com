"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const WindEnergyConversionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
      ).then(({ WindEnergyConversionLab }) => WindEnergyConversionLab))(),
  }))
);
