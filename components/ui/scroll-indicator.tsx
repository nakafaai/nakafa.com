"use client";

import { motion, useScroll, useSpring } from "motion/react";

type Props = {
  hidden?: boolean;
};

export function ScrollIndicator({ hidden }: Props) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <>
      <motion.div
        id="scroll-indicator"
        style={{
          scaleX,
          position: "fixed",
          zIndex: 20,
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          originX: 0,
          backgroundColor: "var(--primary)",
          ...(hidden && {
            display: "none",
          }),
        }}
      />
    </>
  );
}
