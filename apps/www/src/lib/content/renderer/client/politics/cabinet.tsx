"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MerahPutihCabinetChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/politics/merah-putih/chart"
      ).then(({ CabinetChart }) => CabinetChart))(),
  }))
);

export const MerahPutihCompositionChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/politics/merah-putih/chart"
      ).then(({ CompositionChart }) => CompositionChart))(),
  }))
);
