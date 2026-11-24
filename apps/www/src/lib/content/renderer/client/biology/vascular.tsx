"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PhloemTranslocationLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/phloem/lab").then(
      (module) => ({ default: module.PhloemTranslocationLab })
    )
  )
);

export const PhytoremediationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/remediation/lab"
    ).then((module) => ({ default: module.PhytoremediationLab }))
  )
);

export const XylemCohesionLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/xylem/lab").then(
      (module) => ({ default: module.XylemCohesionLab })
    )
  )
);
