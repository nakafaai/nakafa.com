"use client";

import dynamic from "next/dynamic";

export const FungiMyceliumLab = dynamic(() =>
  import("@repo/design-system/components/contents/biology/fungi").then(
    ({ FungiMyceliumLab }) => FungiMyceliumLab
  )
);
