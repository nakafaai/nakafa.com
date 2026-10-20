"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const IonLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/ion/lab").then(
      (module) => ({ default: module.IonLab })
    )
  )
);

export const IsotopeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/isotope/lab"
    ).then((module) => ({ default: module.IsotopeLab }))
  )
);

export const MatterParticleReaderLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
    ).then((module) => ({ default: module.MatterParticleReaderLab }))
  )
);

export const SubatomicParticlePropertiesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
    ).then((module) => ({ default: module.SubatomicParticlePropertiesLab }))
  )
);

export const SubatomicParticlesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
    ).then((module) => ({ default: module.SubatomicParticlesLab }))
  )
);
