"use client";

import createGlobe, { type COBEOptions, type Marker } from "cobe";
import { useEffect, useRef } from "react";
import { useSpring } from "react-spring";

// --- Constants ---

// Marker locations and sizes
const MUNICH_LAT = 48.137_154;
const MUNICH_LNG = 11.576_124;
const MUNICH_SIZE = 0.09;

const JAKARTA_LAT = -6.2;
const JAKARTA_LNG = 106.816_666;
const JAKARTA_SIZE = 0.08;

const NEW_YORK_LAT = 40.730_61;
const NEW_YORK_LNG = -73.935_242;
const NEW_YORK_SIZE = 0.06;

const DUBAI_LAT = 25.276_987;
const DUBAI_LNG = 55.296_249;
const DUBAI_SIZE = 0.08;

const SAO_PAULO_LAT = -23.533_773;
const SAO_PAULO_LNG = -46.625_29;
const SAO_PAULO_SIZE = 0.07;

const MARKER_LOCATIONS = {
  MUNICH: {
    location: [MUNICH_LAT, MUNICH_LNG] as [number, number],
    size: MUNICH_SIZE,
  },
  JAKARTA: {
    location: [JAKARTA_LAT, JAKARTA_LNG] as [number, number],
    size: JAKARTA_SIZE,
  },
  NEW_YORK: {
    location: [NEW_YORK_LAT, NEW_YORK_LNG] as [number, number],
    size: NEW_YORK_SIZE,
  },
  DUBAI: {
    location: [DUBAI_LAT, DUBAI_LNG] as [number, number],
    size: DUBAI_SIZE,
  },
  SAO_PAULO: {
    location: [SAO_PAULO_LAT, SAO_PAULO_LNG] as [number, number],
    size: SAO_PAULO_SIZE,
  },
};

// Default colors
const RGB_MAX = 255;
const WHITE_COLOR_VALUE = 1;
const GLOW_COLOR_VALUE = 1.2;
const MARKER_RED = 251;
const MARKER_GREEN = 100;
const MARKER_BLUE = 21;

const BASE_COLOR_RGB: [number, number, number] = [
  WHITE_COLOR_VALUE,
  WHITE_COLOR_VALUE,
  WHITE_COLOR_VALUE,
];
const MARKER_COLOR_RGB: [number, number, number] = [
  MARKER_RED / RGB_MAX,
  MARKER_GREEN / RGB_MAX,
  MARKER_BLUE / RGB_MAX,
];
const GLOW_COLOR_RGB: [number, number, number] = [
  GLOW_COLOR_VALUE,
  GLOW_COLOR_VALUE,
  GLOW_COLOR_VALUE,
];

// Animation and interaction constants
const PHI_INCREMENT = 0.001_25;
const MOUSE_DRAG_SENSITIVITY = 200;
const TOUCH_DRAG_SENSITIVITY = 100;
const MAX_CANVAS_WIDTH = 500;

// --- Component ---

type Props = {
  baseColor?: COBEOptions["baseColor"];
  markerColor?: COBEOptions["markerColor"];
  glowColor?: COBEOptions["glowColor"];
  markers?: COBEOptions["markers"];
};

const defaultMarkers: Marker[] = [
  MARKER_LOCATIONS.MUNICH,
  MARKER_LOCATIONS.JAKARTA,
  MARKER_LOCATIONS.NEW_YORK,
  MARKER_LOCATIONS.DUBAI,
  MARKER_LOCATIONS.SAO_PAULO,
];

const defaultOptions: Required<
  Pick<Props, "baseColor" | "markerColor" | "glowColor" | "markers">
> = {
  baseColor: BASE_COLOR_RGB,
  markerColor: MARKER_COLOR_RGB,
  glowColor: GLOW_COLOR_RGB,
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

    function onResize() {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    }
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
          phi += PHI_INCREMENT;
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
        maxWidth: MAX_CANVAS_WIDTH,
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
            api.start({ r: delta / MOUSE_DRAG_SENSITIVITY });
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
            api.start({ r: delta / TOUCH_DRAG_SENSITIVITY });
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
