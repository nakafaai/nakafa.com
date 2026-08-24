"use client";

import dynamic from "next/dynamic";

export const BacteriaStructureLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/bacteria").then(
    ({ BacteriaStructureLab }) => BacteriaStructureLab
  )
);
