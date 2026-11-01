"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FungiMyceliumLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/fungi").then(
      (module) => ({ default: module.FungiMyceliumLab })
    )
  )
);
