"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const HaberAmmoniaConverterLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/haber/lab").then(
      (module) => ({ default: module.HaberAmmoniaConverterLab })
    )
  )
);

export const SaponificationKettleLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/kettle/lab").then(
      (module) => ({ default: module.SaponificationKettleLab })
    )
  )
);

export const SoapMicelleEmulsionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/micelle/lab"
    ).then((module) => ({ default: module.SoapMicelleEmulsionLab }))
  )
);
