import type { ParabolicMotionState } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode } from "react";

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
  return useRequired(ParabolicMotionContext, "useParabolicMotion");
}
