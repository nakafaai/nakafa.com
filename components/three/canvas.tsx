"use client";

import { isMobileDevice } from "@/lib/utils";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

function ThreeCanvasComponent({
  children,
  ...props
}: { children: ReactNode } & CanvasProps) {
  const [pixelRatio, setPixelRatio] = useState(1);
  const [powerPreference, setPowerPreference] = useState<
    "high-performance" | "low-power" | "default"
  >("default");

  // Detect device capabilities and adjust settings
  useEffect(() => {
    const checkPerformance = () => {
      // Check device pixel ratio and cap it for performance
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Check if device is mobile
      const isMobile = isMobileDevice();

      // Check available memory (if supported)
      // @ts-expect-error - experimental API
      const memory = navigator.deviceMemory;

      // Check hardware concurrency (CPU cores)
      const cores = navigator.hardwareConcurrency || 4;

      // Determine performance profile
      if (isMobile || memory < 4 || cores < 4) {
        // Low-end device settings
        setPixelRatio(Math.min(devicePixelRatio, 1));
        setPowerPreference("low-power");
      } else if (memory >= 8 && cores >= 8) {
        // High-end device settings
        setPixelRatio(Math.min(devicePixelRatio, 2));
        setPowerPreference("high-performance");
      } else {
        // Mid-range device settings
        setPixelRatio(Math.min(devicePixelRatio, 1.5));
        setPowerPreference("default");
      }
    };

    checkPerformance();
  }, []);

  // Memoize GL settings for performance
  const glSettings = useMemo(
    () => ({
      antialias: pixelRatio <= 1.5, // Disable antialiasing on high DPR to save performance
      alpha: true,
      powerPreference,
      stencil: false, // Disable if not needed
      depth: true,
      // Performance optimizations
      failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
      // Additional optimizations
      logarithmicDepthBuffer: false, // Only enable if needed for large scenes
      precision: "mediump", // Use medium precision for better performance
    }),
    [pixelRatio, powerPreference]
  );

  return (
    <Canvas
      {...props}
      shadows={false} // Disable shadows by default for performance
      dpr={[0.5, pixelRatio]} // Allow dynamic downscaling
      gl={glSettings}
      camera={{
        fov: 50,
        near: 0.1,
        far: 100, // Reduce far plane for better depth precision
      }}
      // Flat shading for performance
      flat={pixelRatio <= 1}
      // Linear color space for better performance
      linear={false}
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
