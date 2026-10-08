"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set4Question14PriceChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-4/question-14"
    ).then(({ PriceChart }) => PriceChart)
  )
);
