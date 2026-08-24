"use client";

import dynamic from "next/dynamic";

export const IonLab = dynamic(() =>
  import("@repo/design-system/components/contents/chemistry/ion/lab").then(
    ({ IonLab }) => IonLab
  )
);

export const IsotopeLab = dynamic(() =>
  import("@repo/design-system/components/contents/chemistry/isotope/lab").then(
    ({ IsotopeLab }) => IsotopeLab
  )
);

export const MatterParticleReaderLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
  ).then(({ MatterParticleReaderLab }) => MatterParticleReaderLab)
);

export const SubatomicParticlePropertiesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
  ).then(({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab)
);

export const SubatomicParticlesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
  ).then(({ SubatomicParticlesLab }) => SubatomicParticlesLab)
);
