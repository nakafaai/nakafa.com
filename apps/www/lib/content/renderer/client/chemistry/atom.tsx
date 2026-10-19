"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AncientAtomLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/ancient-atom/lab"
    ).then(({ AncientAtomLab }) => AncientAtomLab)
  )
);

export const AtomShellLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-shell/lab"
    ).then(({ AtomShellLab }) => AtomShellLab)
  )
);

export const AtomSymbolLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/atom-symbol/lab"
    ).then(({ AtomSymbolLab }) => AtomSymbolLab)
  )
);

export const DaltonEvidenceLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/chemistry/dalton-evidence/lab"
    ).then(({ DaltonEvidenceLab }) => DaltonEvidenceLab)
  )
);
