"use client";

import dynamic from "next/dynamic";

export const LazyBacteriaStructureLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/bacteria").then(
    ({ BacteriaStructureLab }) => BacteriaStructureLab
  )
);
export const LazyGreenhouseEffectLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/climate-greenhouse"
  ).then(({ GreenhouseEffectLab }) => GreenhouseEffectLab)
);
export const LazyClimateObservationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/climate-observation"
  ).then(({ ClimateObservationLab }) => ClimateObservationLab)
);
export const LazyFungiMyceliumLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/fungi").then(
    ({ FungiMyceliumLab }) => FungiMyceliumLab
  )
);
export const LazySarsCov2VirionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/sars-cov-2-virion"
  ).then(({ SarsCov2VirionLab }) => SarsCov2VirionLab)
);
export const LazyVirusReplicationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-replication"
  ).then(({ VirusReplicationLab }) => VirusReplicationLab)
);
export const LazyVirusRoleLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/virus-role").then(
    ({ VirusRoleLab }) => VirusRoleLab
  )
);
export const LazyVirusMorphologyLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-structure"
  ).then(({ VirusMorphologyLab }) => VirusMorphologyLab)
);
export const LazyVirusStructureLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/virus-structure"
  ).then(({ VirusStructureLab }) => VirusStructureLab)
);
