"use client";

import dynamic from "next/dynamic";

export const ParabolicMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
  ).then(({ ParabolicMovementLab }) => ParabolicMovementLab)
);

export const ParabolicMovementAnalysisLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
  ).then(({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab)
);
