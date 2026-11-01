"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set2Question15SalesChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-15"
    ).then((module) => ({ default: module.SalesChart }))
  )
);

export const Set2Question5SalesChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-5"
    ).then((module) => ({ default: module.SalesChart }))
  )
);
