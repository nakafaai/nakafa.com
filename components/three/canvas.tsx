"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

function ThreeCanvasComponent({
  children,
  ...props
}: { children: ReactNode } & CanvasProps) {
  return (
    <Canvas
      {...props}
      shadows
      dpr={[1, 4]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
      }}
      linear
    >
      {children}
    </Canvas>
  );
}

export const ThreeCanvas = dynamic(
  () => Promise.resolve(ThreeCanvasComponent),
  {
    ssr: false,
  }
);
