"use client";

import type { ParabolicMotionState } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { createContext, type ReactNode, use } from "react";

const ParabolicMotionContext = createContext<ParabolicMotionState | null>(null);

/** Provides one parabolic lab's motion to the parts of its scene. */
export function ParabolicMotionProvider({
  children,
  motion,
}: {
  children: ReactNode;
  motion: ParabolicMotionState;
}) {
  return (
    <ParabolicMotionContext value={motion}>{children}</ParabolicMotionContext>
  );
}

/** Reads the motion of the surrounding parabolic lab. */
export function useParabolicMotion() {
  const motion = use(ParabolicMotionContext);
  if (!motion) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useParabolicMotion must be used within ParabolicMotionProvider"
    );
  }
  return motion;
}
