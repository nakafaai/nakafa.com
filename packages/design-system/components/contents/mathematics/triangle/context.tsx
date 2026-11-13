import type { TRIANGLE_SIDES } from "@repo/design-system/components/three/triangle/sides";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode } from "react";

/** The authored side names of a triangle, keyed by each side. */
export type TriangleLabels = Record<
  (typeof TRIANGLE_SIDES)[number]["key"],
  ReactNode
>;

/** The configuration of one triangle card, shared by its scene, its readout, and its angle control. */
interface TriangleConfig {
  angle: number;
  labels: TriangleLabels;
  size: number;
}

const TriangleContext = createContext<TriangleConfig | null>(null);

/** Provides one triangle card's configuration to its parts. */
export function TriangleProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: TriangleConfig;
}) {
  return <TriangleContext value={config}>{children}</TriangleContext>;
}

/** Reads the configuration of the surrounding triangle card. */
export function useTriangle() {
  return useRequired(TriangleContext, "useTriangle");
}
