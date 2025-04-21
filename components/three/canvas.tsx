"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

function CanvasComponent({
  children,
  ...props
}: { children: ReactNode } & CanvasProps) {
  return (
    <Canvas {...props} shadows dpr={[1, 2]} gl={{ antialias: true }}>
      {children}
    </Canvas>
  );
}

export const ThreeCanvas = dynamic(() => Promise.resolve(CanvasComponent));
