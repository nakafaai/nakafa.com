"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import type { ReactNode } from "react";

export function ThreeCanvas({
  children,
  ...props
}: { children: ReactNode } & CanvasProps) {
  return (
    <Canvas
      {...props}
      shadows
      dpr={[1, 4]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {children}
    </Canvas>
  );
}
