"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GreenhouseEffectLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/climate-greenhouse"
      ).then(({ GreenhouseEffectLab }) => GreenhouseEffectLab))(),
  }))
);

export const ClimateObservationLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/climate-observation"
      ).then(({ ClimateObservationLab }) => ClimateObservationLab))(),
  }))
);
