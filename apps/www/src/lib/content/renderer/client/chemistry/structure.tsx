"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AlkaliWaterLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/alkali/lab").then(
      (module) => ({ default: module.AlkaliWaterLab })
    )
  )
);

export const IonFormationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/transfer/lab"
    ).then((module) => ({ default: module.IonFormationLab }))
  )
);

export const IonLatticeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/lattice/lab"
    ).then((module) => ({ default: module.IonLatticeLab }))
  )
);

export const MassSpectrometerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/spectrometer/lab"
    ).then((module) => ({ default: module.MassSpectrometerLab }))
  )
);

export const MillikanOilDropLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/millikan/lab"
    ).then((module) => ({ default: module.MillikanOilDropLab }))
  )
);

export const ParticleTrackLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/tracks/lab").then(
      (module) => ({ default: module.ParticleTrackLab })
    )
  )
);

export const RadioactiveDecayLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/decay/lab").then(
      (module) => ({ default: module.RadioactiveDecayLab })
    )
  )
);
