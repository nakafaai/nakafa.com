"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UnitCircle = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/unit-circle"
    ).then(({ UnitCircle }) => UnitCircle)
  )
);
