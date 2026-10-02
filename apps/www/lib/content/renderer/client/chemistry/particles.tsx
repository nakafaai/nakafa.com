"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const IonLab = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/contents/chemistry/ion/lab").then(
      ({ IonLab }) => IonLab
    )
  )
);

export const IsotopeLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/isotope/lab"
    ).then(({ IsotopeLab }) => IsotopeLab)
  )
);

export const MatterParticleReaderLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
    ).then(({ MatterParticleReaderLab }) => MatterParticleReaderLab)
  )
);

export const SubatomicParticlePropertiesLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
    ).then(
      ({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab
    )
  )
);

export const SubatomicParticlesLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
    ).then(({ SubatomicParticlesLab }) => SubatomicParticlesLab)
  )
);
