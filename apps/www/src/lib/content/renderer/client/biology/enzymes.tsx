"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ActiveSiteLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/enzyme/lab").then(
      (module) => ({ default: module.ActiveSiteLab })
    )
  )
);

export const DenatureLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/denature/lab").then(
      (module) => ({ default: module.DenatureLab })
    )
  )
);

export const EnzymeSaturationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/saturation/lab"
    ).then((module) => ({ default: module.EnzymeSaturationLab }))
  )
);

export const EnzymeSecretionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/secretion/lab"
    ).then((module) => ({ default: module.EnzymeSecretionLab }))
  )
);

export const LactaseColumnLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/lactase/lab").then(
      (module) => ({ default: module.LactaseColumnLab })
    )
  )
);
