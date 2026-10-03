"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChemicalReactionCharacteristicsLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
    ).then(
      ({ ChemicalReactionCharacteristicsLab }) =>
        ChemicalReactionCharacteristicsLab
    )
  )
);

export const ChemicalReactionTypesLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
    ).then(({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab)
  )
);

export const MethaneCombustionEquationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
    ).then(({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab)
  )
);
