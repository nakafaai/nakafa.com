"use client";

import dynamic from "next/dynamic";

export const ElectronConfigurationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
  ).then(({ ElectronConfigurationLab }) => ElectronConfigurationLab)
);

export const ValenceElectronLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/valence-electron/lab"
  ).then(({ ValenceElectronLab }) => ValenceElectronLab)
);
