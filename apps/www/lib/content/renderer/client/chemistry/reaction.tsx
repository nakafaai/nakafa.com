"use client";

import dynamic from "next/dynamic";

export const ChemicalReactionCharacteristicsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
  ).then(
    ({ ChemicalReactionCharacteristicsLab }) =>
      ChemicalReactionCharacteristicsLab
  )
);

export const ChemicalReactionTypesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
  ).then(({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab)
);

export const MethaneCombustionEquationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
  ).then(({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab)
);
