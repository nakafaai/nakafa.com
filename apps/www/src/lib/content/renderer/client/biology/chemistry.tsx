"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

const LazyChromosomePackingLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/chromosome/lab").then(
    (module) => ({ default: module.ChromosomePackingLab })
  )
);

const LazyGlycosidicBondLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/sugar/lab").then(
    (module) => ({ default: module.GlycosidicBondLab })
  )
);

const LazyLipidLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/lipid/lab").then(
    (module) => ({ default: module.LipidLab })
  )
);

const LazyProteinFoldLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/protein/lab").then(
    (module) => ({ default: module.ProteinFoldLab })
  )
);

const LazyWaterBondLab = lazy(() =>
  import("@repo/design-system/components/contents/biology/water/lab").then(
    (module) => ({ default: module.WaterBondLab })
  )
);

export const ChromosomePackingLab = withHydrationBoundary(
  LazyChromosomePackingLab
);
export const GlycosidicBondLab = withHydrationBoundary(LazyGlycosidicBondLab);
export const LipidLab = withHydrationBoundary(LazyLipidLab);
export const ProteinFoldLab = withHydrationBoundary(LazyProteinFoldLab);
export const WaterBondLab = withHydrationBoundary(LazyWaterBondLab);
