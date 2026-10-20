"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ElectronConfigurationLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
      ).then(({ ElectronConfigurationLab }) => ElectronConfigurationLab))(),
  }))
);

export const ValenceElectronLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/valence-electron/lab"
      ).then(({ ValenceElectronLab }) => ValenceElectronLab))(),
  }))
);
