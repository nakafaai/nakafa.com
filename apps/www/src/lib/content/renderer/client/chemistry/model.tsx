"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BohrEmissionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/emission/lab"
    ).then((module) => ({ default: module.BohrEmissionLab }))
  )
);

export const CathodeRayLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/cathode/lab"
    ).then((module) => ({ default: module.CathodeRayLab }))
  )
);

export const OrbitalCloudLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/orbital/lab"
    ).then((module) => ({ default: module.OrbitalCloudLab }))
  )
);

export const RutherfordScatteringLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/scattering/lab"
    ).then((module) => ({ default: module.RutherfordScatteringLab }))
  )
);
