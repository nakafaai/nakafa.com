"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const IonLab = withHydrationBoundary(
  lazyComponent(() =>
    import("@repo/design-system/components/contents/chemistry/ion/lab").then(
      ({ IonLab }) => IonLab
    )
  )
);

export const IsotopeLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/isotope/lab"
    ).then(({ IsotopeLab }) => IsotopeLab)
  )
);

export const MatterParticleReaderLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
    ).then(({ MatterParticleReaderLab }) => MatterParticleReaderLab)
  )
);

export const SubatomicParticlePropertiesLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
    ).then(
      ({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab
    )
  )
);

export const SubatomicParticlesLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
    ).then(({ SubatomicParticlesLab }) => SubatomicParticlesLab)
  )
);
