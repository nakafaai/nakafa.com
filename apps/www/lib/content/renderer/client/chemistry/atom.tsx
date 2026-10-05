"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AncientAtomLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/ancient-atom/lab"
    ).then(({ AncientAtomLab }) => AncientAtomLab)
  )
);

export const AtomShellLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-shell/lab"
    ).then(({ AtomShellLab }) => AtomShellLab)
  )
);

export const AtomSymbolLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-symbol/lab"
    ).then(({ AtomSymbolLab }) => AtomSymbolLab)
  )
);

export const DaltonEvidenceLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/chemistry/dalton-evidence/lab"
    ).then(({ DaltonEvidenceLab }) => DaltonEvidenceLab)
  )
);
