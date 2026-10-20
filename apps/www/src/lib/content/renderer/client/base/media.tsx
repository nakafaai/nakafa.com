"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MermaidMdx = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/markdown/mermaid").then(
        ({ MermaidMdx: Component }) => Component
      ))(),
  }))
);

export const Youtube = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/markdown/youtube").then(
        ({ Youtube: Component }) => Component
      ))(),
  }))
);
