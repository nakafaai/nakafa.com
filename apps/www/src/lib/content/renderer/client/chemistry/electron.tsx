"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ElectronConfigurationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
    ).then((module) => ({ default: module.ElectronConfigurationLab }))
  )
);

export const ValenceElectronLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/valence-electron/lab"
    ).then((module) => ({ default: module.ValenceElectronLab }))
  )
);
