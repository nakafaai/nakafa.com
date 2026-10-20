"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set3Question14SpiceSalesChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-3/question-14"
    ).then(({ SpiceSalesChart }) => SpiceSalesChart)
  )
);
