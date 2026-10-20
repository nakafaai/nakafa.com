"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set5Question18GrowthChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-5/question-18"
    ).then((module) => ({ default: module.GrowthChart }))
  )
);

export const Set5Question6SalesChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-5/question-6"
    ).then((module) => ({ default: module.SalesChart }))
  )
);
