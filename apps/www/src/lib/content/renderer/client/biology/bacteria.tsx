"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacteriaStructureLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/bacteria").then(
      (module) => ({ default: module.BacteriaStructureLab })
    )
  )
);
