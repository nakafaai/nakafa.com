"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set9Question9GraduationChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-9/question-9"
    ).then(({ GraduationChart }) => GraduationChart)
  )
);
