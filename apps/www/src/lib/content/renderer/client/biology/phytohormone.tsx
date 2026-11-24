"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AuxinAgarBendLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/auxin/lab").then(
      (module) => ({ default: module.AuxinAgarBendLab })
    )
  )
);

export const PhytohormoneActionLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/hormone/lab").then(
      (module) => ({ default: module.PhytohormoneActionLab })
    )
  )
);
