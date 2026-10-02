"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SequenceConceptTableChairsAnimation = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/sequence/animation"
    ).then(({ default: Animation }) => Animation)
  )
);
