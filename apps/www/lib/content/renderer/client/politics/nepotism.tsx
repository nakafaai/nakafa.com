"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NepotismStage = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/nepotism/stage"
    ).then(({ Stage }) => Stage)
  )
);
