"use client";

import type { LineSceneConfig } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { CoordinateProvider } from "@repo/design-system/components/three/controls";
import { createContext, type ReactNode, use } from "react";

const LineSceneContext = createContext<LineSceneConfig | null>(null);

/** Provides one line-equation card's scene configuration and its coordinate controls. */
export function LineEquationProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: LineSceneConfig;
}) {
  return (
    <CoordinateProvider>
      <LineSceneContext value={config}>{children}</LineSceneContext>
    </CoordinateProvider>
  );
}

/** Reads the scene configuration of the surrounding line-equation card. */
export function useLineScene() {
  const config = use(LineSceneContext);
  if (!config) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useLineScene must be used within LineEquationProvider");
  }
  return config;
}
