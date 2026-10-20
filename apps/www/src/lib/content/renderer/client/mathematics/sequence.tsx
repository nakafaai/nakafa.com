"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SequenceConceptTableChairsAnimation = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/sequence/animation"
      ).then(({ default: Animation }) => Animation))(),
  }))
);
