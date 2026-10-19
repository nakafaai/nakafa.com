"use client";

import type { GlbbLabels } from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import { createContext, type ReactNode, use } from "react";

const GlbbLabelsContext = createContext<GlbbLabels | null>(null);

/** Provides one non-uniform motion card's labels to its scenario toggle and its graph. */
export function GlbbLabelsProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels: GlbbLabels;
}) {
  return <GlbbLabelsContext value={labels}>{children}</GlbbLabelsContext>;
}

/** Reads the labels of the surrounding non-uniform motion card. */
export function useGlbbLabels() {
  const labels = use(GlbbLabelsContext);
  if (!labels) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useGlbbLabels must be used within GlbbLabelsProvider");
  }
  return labels;
}
