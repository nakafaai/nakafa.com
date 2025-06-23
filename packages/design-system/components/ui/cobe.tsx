"use client";

import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useRef } from "react";
import { useSpring } from "react-spring";

type Props = {
  baseColor?: COBEOptions["baseColor"];
  markerColor?: COBEOptions["markerColor"];
  glowColor?: COBEOptions["glowColor"];
  markers?: COBEOptions["markers"];
};

const defaultMarkers: Required<Pick<Props, "markers">>["markers"] = [
  // Latitude, Longitude
  { location: [48.137_154, 11.576_124], size: 0.09 },
  { location: [-6.2, 106.816_666], size: 0.08 },
  { location: [40.730_61, -73.935_242], size: 0.06 },
  { location: [25.276_987, 55.296_249], size: 0.08 },
  { location: [-23.533_773, -46.625_29], size: 0.07 },
];

const defaultOptions: Required<
  Pick<Props, "baseColor" | "markerColor" | "glowColor" | "markers">
> = {
  baseColor: [1, 1, 1],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1.2, 1.2, 1.2],
  markers: defaultMarkers,
};

export function Cobe({
  baseColor = defaultOptions.baseColor,
  markerColor = defaultOptions.markerColor,
  glowColor = defaultOptions.glowColor,
  markers = defaultOptions.markers,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef<number>(0);

  const [{ r }, api] = useSpring(() => ({
    r: 0,
    config: { mass: 1, tension: 280, friction: 40, precision: 0.001 },
  }));

  useEffect(() => {
    let phi = 0;
    let width = 0;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);
    onResize();
    if (!canvasRef.current) {
      return;
    }

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.2,
      dark: 1.1,
      diffuse: 2,
      mapSamples: 16_000,
      mapBrightness: 1.8,
      mapBaseBrightness: 0.05,
      baseColor,
      markerColor,
      glowColor,
      markers,
      opacity: 0.7,
      onRender: (state) => {
        // This prevents rotation while dragging
        if (!pointerInteracting.current) {
          // Called on every animation frame.
          // `state` will be an empty object, return updated params.
          phi += 0.001_25;
        }
        state.phi = phi + r.get();
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    });
    return () => globe.destroy();
  }, [r, markers, baseColor, markerColor, glowColor]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 500,
        aspectRatio: 1,
        margin: "auto",
        position: "relative",
      }}
    >
      <canvas
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            api.start({ r: delta / 200 });
          }
        }}
        onPointerDown={(e) => {
          pointerInteracting.current =
            e.clientX - pointerInteractionMovement.current;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grabbing";
          }
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            api.start({ r: delta / 100 });
          }
        }}
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          aspectRatio: 1,
          cursor: "grab",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
