"use client";

import dynamic from "next/dynamic";

export const NonUniformLinearMotionGraphCard = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
  ).then(
    ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
  )
);

export const NonUniformLinearMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
  ).then(({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab)
);

export const UniformLinearMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
  ).then(({ UniformLinearMotionLab }) => UniformLinearMotionLab)
);
