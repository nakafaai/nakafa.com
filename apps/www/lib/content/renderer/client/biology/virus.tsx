"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VirusReplicationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-replication"
    ).then(({ VirusReplicationLab }) => VirusReplicationLab)
  )
);

export const VirusRoleLab = withHydrationBoundary(
  dynamic(() =>
    import("@repo/design-system/components/contents/biology/virus-role").then(
      ({ VirusRoleLab }) => VirusRoleLab
    )
  )
);

export const VirusMorphologyLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then(({ VirusMorphologyLab }) => VirusMorphologyLab)
  )
);

export const VirusStructureLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then(({ VirusStructureLab }) => VirusStructureLab)
  )
);
