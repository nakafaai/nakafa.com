"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AncientAtomLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/ancient-atom/lab"
    ).then((module) => ({ default: module.AncientAtomLab }))
  )
);

export const AtomShellLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-shell/lab"
    ).then((module) => ({ default: module.AtomShellLab }))
  )
);

export const AtomSymbolLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-symbol/lab"
    ).then((module) => ({ default: module.AtomSymbolLab }))
  )
);

export const DaltonEvidenceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/dalton-evidence/lab"
    ).then((module) => ({ default: module.DaltonEvidenceLab }))
  )
);
