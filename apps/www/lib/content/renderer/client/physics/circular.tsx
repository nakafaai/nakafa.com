"use client";

import dynamic from "next/dynamic";

export const UniformCircularMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
  ).then(({ UniformCircularMotionLab }) => UniformCircularMotionLab)
);
