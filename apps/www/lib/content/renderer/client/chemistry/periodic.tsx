"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ModernPeriodicTableLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
    ).then(({ ModernPeriodicTableLab }) => ModernPeriodicTableLab)
  )
);

export const PeriodicPropertiesLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
    ).then(({ PeriodicPropertiesLab }) => PeriodicPropertiesLab)
  )
);
