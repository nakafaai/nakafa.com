import type { AccelerationLabels } from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode } from "react";

const AccelerationLabelsContext = createContext<AccelerationLabels | null>(
  null
);

/** Provides one acceleration card's labels to its case toggle and its graph. */
export function AccelerationLabelsProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels: AccelerationLabels;
}) {
  return (
    <AccelerationLabelsContext value={labels}>
      {children}
    </AccelerationLabelsContext>
  );
}

/** Reads the labels of the surrounding acceleration card. */
export function useAccelerationLabels() {
  return useRequired(AccelerationLabelsContext, "useAccelerationLabels");
}
