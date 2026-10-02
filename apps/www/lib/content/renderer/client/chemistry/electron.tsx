"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ElectronConfigurationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
    ).then(({ ElectronConfigurationLab }) => ElectronConfigurationLab)
  )
);

export const ValenceElectronLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/valence-electron/lab"
    ).then(({ ValenceElectronLab }) => ValenceElectronLab)
  )
);
