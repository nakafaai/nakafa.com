"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MicroscopeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/microscope/lab"
    ).then((module) => ({ default: module.MicroscopeLab }))
  )
);

export const NephronLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/nephron/lab").then(
      (module) => ({ default: module.NephronLab })
    )
  )
);

export const RespirometerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/respirometer/lab"
    ).then((module) => ({ default: module.RespirometerLab }))
  )
);
