"use client";

import dynamic from "next/dynamic";

export const AncientAtomLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/ancient-atom/lab"
  ).then(({ AncientAtomLab }) => AncientAtomLab)
);

export const AtomShellLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/atom-shell/lab"
  ).then(({ AtomShellLab }) => AtomShellLab)
);

export const AtomSymbolLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/atom-symbol/lab"
  ).then(({ AtomSymbolLab }) => AtomSymbolLab)
);

export const DaltonEvidenceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/dalton-evidence/lab"
  ).then(({ DaltonEvidenceLab }) => DaltonEvidenceLab)
);
