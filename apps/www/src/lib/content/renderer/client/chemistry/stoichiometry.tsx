"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AvogadroGasVolumeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/avogadro/lab"
    ).then((module) => ({ default: module.AvogadroGasVolumeLab }))
  )
);

export const CalorimeterEnthalpyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/enthalpy/lab"
    ).then((module) => ({ default: module.CalorimeterEnthalpyLab }))
  )
);
