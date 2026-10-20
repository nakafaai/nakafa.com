"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NepotismStage = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/nepotism/stage"
    ).then(({ Stage }) => Stage)
  )
);
