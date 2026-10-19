"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ElectronConfigurationLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
    ).then(({ ElectronConfigurationLab }) => ElectronConfigurationLab)
  )
);

export const ValenceElectronLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/valence-electron/lab"
    ).then(({ ValenceElectronLab }) => ValenceElectronLab)
  )
);
