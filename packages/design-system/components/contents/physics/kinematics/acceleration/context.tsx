"use client";

import type { AccelerationLabels } from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { createContext, type ReactNode, use } from "react";

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
  const labels = use(AccelerationLabelsContext);
  if (!labels) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useAccelerationLabels must be used within AccelerationLabelsProvider"
    );
  }
  return labels;
}
