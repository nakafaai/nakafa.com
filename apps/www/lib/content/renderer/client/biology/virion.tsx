"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SarsCov2VirionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/sars-cov-2-virion"
    ).then(({ SarsCov2VirionLab }) => SarsCov2VirionLab)
  )
);
