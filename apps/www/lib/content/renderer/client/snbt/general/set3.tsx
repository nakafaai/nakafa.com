"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set3Question14SpiceSalesChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-3/question-14"
    ).then(({ SpiceSalesChart }) => SpiceSalesChart)
  )
);
