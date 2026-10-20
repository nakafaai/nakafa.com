"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const IonLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/contents/chemistry/ion/lab").then(
        ({ IonLab }) => IonLab
      ))(),
  }))
);

export const IsotopeLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/isotope/lab"
      ).then(({ IsotopeLab }) => IsotopeLab))(),
  }))
);

export const MatterParticleReaderLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
      ).then(({ MatterParticleReaderLab }) => MatterParticleReaderLab))(),
  }))
);

export const SubatomicParticlePropertiesLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
      ).then(
        ({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab
      ))(),
  }))
);

export const SubatomicParticlesLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
      ).then(({ SubatomicParticlesLab }) => SubatomicParticlesLab))(),
  }))
);
