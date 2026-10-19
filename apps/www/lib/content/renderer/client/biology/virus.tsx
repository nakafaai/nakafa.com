"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VirusReplicationLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-replication"
    ).then(({ VirusReplicationLab }) => VirusReplicationLab)
  )
);

export const VirusRoleLab = withHydrationBoundary(
  lazyComponent(() =>
    import("@repo/design-system/components/contents/biology/virus-role").then(
      ({ VirusRoleLab }) => VirusRoleLab
    )
  )
);

export const VirusMorphologyLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then(({ VirusMorphologyLab }) => VirusMorphologyLab)
  )
);

export const VirusStructureLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then(({ VirusStructureLab }) => VirusStructureLab)
  )
);
