"use client";

import { useThree } from "@react-three/fiber";
import {
  type BiologyItemStore,
  BiologyLabProvider,
  useBiologyItemSelection,
} from "@repo/design-system/components/contents/biology/context";
import type { BiologySceneColors } from "@repo/design-system/components/contents/biology/data";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene-frame";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { type ReactNode, Suspense } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.3;

/**
 * The three-dimensional stage of a biology lab: its lights, the camera of its
 * view, and the scene of the selected item. It loads apart from the lab's card,
 * so the card can hold its frame before the stage has loaded. The provider sits
 * inside the canvas, which renders only in the browser, so a theme change never
 * reaches streamed server HTML.
 */
export function BiologyStage({
  children,
  colors,
  store,
  view,
}: {
  children: ReactNode;
  colors: BiologySceneColors;
  store: BiologyItemStore;
  view: NarrowCameraPose;
}) {
  return (
    <ThreeCanvas frameloop="always">
      <Suspense>
        <BiologyLabProvider colors={colors} store={store}>
          <BiologyCamera view={view} />
          <ambientLight intensity={0.58} />
          <hemisphereLight
            color={colors.skyLight}
            groundColor={colors.soil}
            intensity={0.68}
          />
          <directionalLight
            castShadow
            intensity={1.45}
            position={[4.5, 6, 4.5]}
            shadow-bias={-0.0006}
            shadow-mapSize-height={1024}
            shadow-mapSize-width={1024}
            shadow-normalBias={0.02}
          />
          <pointLight
            color={colors.skyLight}
            intensity={0.34}
            position={[-3, 2, 3]}
          />
          {children}
        </BiologyLabProvider>
      </Suspense>
    </ThreeCanvas>
  );
}

/**
 * Frames the scene again for each item the reader picks, so every item opens
 * from the same camera position.
 */
function BiologyCamera({ view }: { view: NarrowCameraPose }) {
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);

  return <ResponsiveBiologyCamera key={selectedIndex} view={view} />;
}

/**
 * Keeps the active biology scene framed on narrow and wide canvases.
 */
function ResponsiveBiologyCamera({ view }: { view: NarrowCameraPose }) {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? view.narrowCameraPosition
    : view.cameraPosition;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={view.cameraTarget}
      fov={45}
    />
  );
}
