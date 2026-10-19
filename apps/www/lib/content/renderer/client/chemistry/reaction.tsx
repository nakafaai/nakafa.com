"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChemicalReactionCharacteristicsLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
    ).then(
      ({ ChemicalReactionCharacteristicsLab }) =>
        ChemicalReactionCharacteristicsLab
    )
  )
);

export const ChemicalReactionTypesLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
    ).then(({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab)
  )
);

export const MethaneCombustionEquationLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
    ).then(({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab)
  )
);
