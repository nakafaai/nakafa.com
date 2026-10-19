"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SarsCov2VirionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/sars-cov-2-virion"
    ).then(({ SarsCov2VirionLab }) => SarsCov2VirionLab)
  )
);
