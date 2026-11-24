"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

const LazyGametogenesisLab = lazy(() =>
  import(
    "@repo/design-system/components/contents/biology/gametogenesis/lab"
  ).then((module) => ({ default: module.GametogenesisLab }))
);

const LazyImplantationLab = lazy(() =>
  import(
    "@repo/design-system/components/contents/biology/implantation/lab"
  ).then((module) => ({ default: module.ImplantationLab }))
);

const LazyMenstrualCycleLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/menstrual/lab").then(
    (module) => ({ default: module.MenstrualCycleLab })
  )
);

const LazyMetamorphosisLab = lazy(() =>
  import(
    "@repo/design-system/components/contents/biology/metamorphosis/lab"
  ).then((module) => ({ default: module.MetamorphosisLab }))
);

const LazyPlacentaLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/placenta/lab").then(
    (module) => ({ default: module.PlacentaLab })
  )
);

const LazyTwinsLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/twins/lab").then(
    (module) => ({ default: module.TwinsLab })
  )
);

export const GametogenesisLab = withHydrationBoundary(LazyGametogenesisLab);
export const ImplantationLab = withHydrationBoundary(LazyImplantationLab);
export const MenstrualCycleLab = withHydrationBoundary(LazyMenstrualCycleLab);
export const MetamorphosisLab = withHydrationBoundary(LazyMetamorphosisLab);
export const PlacentaLab = withHydrationBoundary(LazyPlacentaLab);
export const TwinsLab = withHydrationBoundary(LazyTwinsLab);
