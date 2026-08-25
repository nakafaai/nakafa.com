"use client";

import dynamic from "next/dynamic";

export const ModernPeriodicTableLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
  ).then(({ ModernPeriodicTableLab }) => ModernPeriodicTableLab)
);

export const PeriodicPropertiesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
  ).then(({ PeriodicPropertiesLab }) => PeriodicPropertiesLab)
);
