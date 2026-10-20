"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VirusReplicationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-replication"
    ).then((module) => ({ default: module.VirusReplicationLab }))
  )
);

export const VirusRoleLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/virus-role").then(
      (module) => ({ default: module.VirusRoleLab })
    )
  )
);

export const VirusMorphologyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then((module) => ({ default: module.VirusMorphologyLab }))
  )
);

export const VirusStructureLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/virus-structure"
    ).then((module) => ({ default: module.VirusStructureLab }))
  )
);
