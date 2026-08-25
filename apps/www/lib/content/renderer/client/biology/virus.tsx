"use client";

import dynamic from "next/dynamic";

export const VirusReplicationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-replication"
  ).then(({ VirusReplicationLab }) => VirusReplicationLab)
);

export const VirusRoleLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/virus-role").then(
    ({ VirusRoleLab }) => VirusRoleLab
  )
);

export const VirusMorphologyLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-structure"
  ).then(({ VirusMorphologyLab }) => VirusMorphologyLab)
);

export const VirusStructureLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-structure"
  ).then(({ VirusStructureLab }) => VirusStructureLab)
);
