"use client";

import dynamic from "next/dynamic";

export const SarsCov2VirionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/sars-cov-2-virion"
  ).then(({ SarsCov2VirionLab }) => SarsCov2VirionLab)
);
