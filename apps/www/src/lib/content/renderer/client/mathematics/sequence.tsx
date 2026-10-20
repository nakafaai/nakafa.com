"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SequenceConceptTableChairsAnimation = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/sequence/animation"
    ).then(({ default: Animation }) => Animation)
  )
);
