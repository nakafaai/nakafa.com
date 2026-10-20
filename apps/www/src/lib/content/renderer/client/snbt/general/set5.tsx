"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set5Question18GrowthChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/snbt/general/set-5/question-18"
      ).then(({ GrowthChart }) => GrowthChart))(),
  }))
);

export const Set5Question6SalesChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/snbt/general/set-5/question-6"
      ).then(({ SalesChart }) => SalesChart))(),
  }))
);
