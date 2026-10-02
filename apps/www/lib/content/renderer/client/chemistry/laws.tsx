"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CombiningVolumesLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/combining-volumes-law/lab"
    ).then(({ CombiningVolumesLab }) => CombiningVolumesLab)
  )
);

export const ConstantCompositionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/constant-composition-law/lab"
    ).then(({ ConstantCompositionLab }) => ConstantCompositionLab)
  )
);

export const MassConservationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/lab"
    ).then(({ MassConservationLab }) => MassConservationLab)
  )
);

export const MultipleProportionsLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/multiple-proportions-law/lab"
    ).then(({ MultipleProportionsLab }) => MultipleProportionsLab)
  )
);
