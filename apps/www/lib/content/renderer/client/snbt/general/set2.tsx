"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set2Question15SalesChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-15"
    ).then(({ SalesChart }) => SalesChart)
  )
);

export const Set2Question5SalesChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-5"
    ).then(({ SalesChart }) => SalesChart)
  )
);
