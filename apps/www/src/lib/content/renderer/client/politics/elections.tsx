"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const KimPlusElectabilityChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/politics/kim-plus/chart"
      ).then(({ ElectabilityChart }) => ElectabilityChart))(),
  }))
);

export const PorkBarrelElectabilityChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/politics/pork-barrel/electability"
      ).then(({ ElectabilityChart }) => ElectabilityChart))(),
  }))
);
