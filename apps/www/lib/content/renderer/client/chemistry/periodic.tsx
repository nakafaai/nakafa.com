"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ModernPeriodicTableLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
    ).then(({ ModernPeriodicTableLab }) => ModernPeriodicTableLab)
  )
);

export const PeriodicPropertiesLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
    ).then(({ PeriodicPropertiesLab }) => PeriodicPropertiesLab)
  )
);
