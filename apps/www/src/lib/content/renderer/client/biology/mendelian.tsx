"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DihybridCrossLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/dihybrid/lab").then(
      (module) => ({ default: module.DihybridCrossLab })
    )
  )
);

export const MonohybridCrossLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/monohybrid/lab"
    ).then((module) => ({ default: module.MonohybridCrossLab }))
  )
);

export const PedigreeSexLinkedLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/pedigree/lab").then(
      (module) => ({ default: module.PedigreeSexLinkedLab })
    )
  )
);
