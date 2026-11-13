"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FizzBalanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/fizz"
    ).then((module) => ({ default: module.FizzBalanceLab }))
  )
);

export const LavoisierCalxLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/calx"
    ).then((module) => ({ default: module.LavoisierCalxLab }))
  )
);

export const PrecipitateLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/cloud"
    ).then((module) => ({ default: module.PrecipitateLab }))
  )
);

export const SteelWoolLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/mass-conservation-law/wool"
    ).then((module) => ({ default: module.SteelWoolLab }))
  )
);
