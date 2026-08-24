"use client";

import dynamic from "next/dynamic";

export const DisplacementDistanceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
  ).then(({ DisplacementDistanceLab }) => DisplacementDistanceLab)
);

export const StoppingDistanceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
  ).then(({ StoppingDistanceLab }) => StoppingDistanceLab)
);
