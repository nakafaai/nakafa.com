"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SarsCov2VirionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/sars-cov-2-virion"
      ).then(({ SarsCov2VirionLab }) => SarsCov2VirionLab))(),
  }))
);
