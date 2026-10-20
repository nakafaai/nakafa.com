"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacterialGrowth = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/animation-bacterial"
      ).then(({ BacterialGrowth }) => BacterialGrowth))(),
  }))
);

export const FunctionExplorationVirusChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
      ).then(({ VirusChart }) => VirusChart))(),
  }))
);
