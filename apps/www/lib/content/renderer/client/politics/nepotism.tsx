"use client";

import dynamic from "next/dynamic";

export const NepotismStage = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/nepotism/stage"
  ).then(({ Stage }) => Stage)
);
