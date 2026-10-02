"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set5Question18GrowthChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-5/question-18"
    ).then(({ GrowthChart }) => GrowthChart)
  )
);

export const Set5Question6SalesChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-5/question-6"
    ).then(({ SalesChart }) => SalesChart)
  )
);
