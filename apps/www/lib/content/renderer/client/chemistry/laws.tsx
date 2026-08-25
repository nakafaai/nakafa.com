"use client";

import dynamic from "next/dynamic";

export const CombiningVolumesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/combining-volumes-law/lab"
  ).then(({ CombiningVolumesLab }) => CombiningVolumesLab)
);

export const ConstantCompositionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/constant-composition-law/lab"
  ).then(({ ConstantCompositionLab }) => ConstantCompositionLab)
);

export const MassConservationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/mass-conservation-law/lab"
  ).then(({ MassConservationLab }) => MassConservationLab)
);

export const MultipleProportionsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/multiple-proportions-law/lab"
  ).then(({ MultipleProportionsLab }) => MultipleProportionsLab)
);
