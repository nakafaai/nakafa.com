"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NeuronImpulseLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/neuron/lab").then(
      (module) => ({ default: module.NeuronImpulseLab })
    )
  )
);

export const SynapseLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/synapse/lab").then(
      (module) => ({ default: module.SynapseLab })
    )
  )
);
