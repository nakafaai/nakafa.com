"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VennSortLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/mathematics/venn/lab").then(
      (module) => ({ default: module.VennSortLab })
    )
  )
);
