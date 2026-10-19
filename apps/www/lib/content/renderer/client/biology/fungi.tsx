"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FungiMyceliumLab = withHydrationBoundary(
  lazyComponent(() =>
    import("@repo/design-system/components/contents/biology/fungi").then(
      ({ FungiMyceliumLab }) => FungiMyceliumLab
    )
  )
);
