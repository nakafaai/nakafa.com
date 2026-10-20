"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ModernPeriodicTableLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
      ).then(({ ModernPeriodicTableLab }) => ModernPeriodicTableLab))(),
  }))
);

export const PeriodicPropertiesLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
      ).then(({ PeriodicPropertiesLab }) => PeriodicPropertiesLab))(),
  }))
);
