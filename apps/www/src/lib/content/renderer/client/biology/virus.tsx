"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VirusReplicationLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/virus-replication"
      ).then(({ VirusReplicationLab }) => VirusReplicationLab))(),
  }))
);

export const VirusRoleLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import("@repo/design-system/components/contents/biology/virus-role").then(
        ({ VirusRoleLab }) => VirusRoleLab
      ))(),
  }))
);

export const VirusMorphologyLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/virus-structure"
      ).then(({ VirusMorphologyLab }) => VirusMorphologyLab))(),
  }))
);

export const VirusStructureLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/biology/virus-structure"
      ).then(({ VirusStructureLab }) => VirusStructureLab))(),
  }))
);
