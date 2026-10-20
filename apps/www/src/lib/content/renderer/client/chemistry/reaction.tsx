"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChemicalReactionCharacteristicsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
    ).then((module) => ({ default: module.ChemicalReactionCharacteristicsLab }))
  )
);

export const ChemicalReactionTypesLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
    ).then((module) => ({ default: module.ChemicalReactionTypesLab }))
  )
);

export const MethaneCombustionEquationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
    ).then((module) => ({ default: module.MethaneCombustionEquationLab }))
  )
);
