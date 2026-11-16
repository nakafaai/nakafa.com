import { useThree } from "@react-three/fiber";
import {
  type BiologyItemStore,
  BiologyLabProvider,
  useBiologyItemSelection,
  useBiologyView,
} from "@repo/design-system/components/contents/biology/context";
import type { BiologySceneColors } from "@repo/design-system/components/contents/biology/data";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
    <ScienceStage frameloop="always" setting="studio">
      <Suspense>
        <BiologyLabProvider colors={colors} store={store} view={view}>
          <BiologyCamera />
          {children}
        </BiologyLabProvider>
      </Suspense>
    </ScienceStage>
  );
}

/**
 * Frames the scene again for each item the reader picks, so every item opens
 * from the same camera position.
 */
function BiologyCamera() {
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);

  return <ResponsiveBiologyCamera key={selectedIndex} />;
}

/**
 * Keeps the active biology scene framed on narrow and wide canvases.
 */
function ResponsiveBiologyCamera() {
  const size = useThree((state) => state.size);
  const view = useBiologyView();
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
