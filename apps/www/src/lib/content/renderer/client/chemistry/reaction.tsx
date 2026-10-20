"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChemicalReactionCharacteristicsLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
      ).then(
        ({ ChemicalReactionCharacteristicsLab }) =>
          ChemicalReactionCharacteristicsLab
      ))(),
  }))
);

export const ChemicalReactionTypesLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
      ).then(({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab))(),
  }))
);

export const MethaneCombustionEquationLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
      ).then(
        ({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab
      ))(),
  }))
);
