import { useThree } from "@react-three/fiber";
import type { BiologyItemStore } from "@repo/design-system/components/contents/biology/context";
import {
  BiologyLabProvider,
  useBiologyItemSelection,
  useBiologyView,
} from "@repo/design-system/components/contents/biology/context";
import type { BiologySceneColors } from "@repo/design-system/components/contents/biology/data";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import type { Place } from "@repo/design-system/components/three/stage/place";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import type { ReactNode } from "react";
import { createContext, use } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.3;

/**
 * How the camera of the surrounding biology stage frames its scene:
 * `content` fits every subject the scene declares, whatever the card's
 * shape; without it the camera keeps the lab's authored pose.
 */
const FramingContext = createContext<"content" | undefined>(undefined);

/**
 * The three-dimensional stage of a biology lab: its lights, the camera of its
 * view, and the scene of the selected item. It loads apart from the lab's card,
 * so the card can hold its frame before the stage has loaded. The provider sits
 * inside the canvas, which renders only in the browser, so a theme change never
 * reaches streamed server HTML.
 *
 * @param setting - The place the lab's subject belongs in
 * @param framing - `content` to fit the camera to the scene's subjects
 */
export function BiologyStage({
  children,
  colors,
  framing,
  setting,
  store,
  view,
}: {
  children: ReactNode;
  colors: BiologySceneColors;
  framing: "content" | undefined;
  setting: Place;
  store: BiologyItemStore;
  view: NarrowCameraPose;
}) {
  return (
    <ScienceStage setting={setting}>
      <BiologyLabProvider colors={colors} store={store} view={view}>
        <FramingContext value={framing}>
          <BiologyCamera />
          {children}
        </FramingContext>
      </BiologyLabProvider>
    </ScienceStage>
  );
}

/**
 * Frames the scene again for each item the reader picks, so every item opens
 * from the same camera position without unmounting the camera or its controls.
 */
function BiologyCamera() {
  const selectedIndex = useBiologyItemSelection((state) => state.selectedIndex);

  return <ResponsiveBiologyCamera selectedIndex={selectedIndex} />;
}

/**
 * Keeps the active biology scene framed on narrow and wide canvases.
 */
function ResponsiveBiologyCamera({
  selectedIndex,
}: {
  readonly selectedIndex: number;
}) {
  const size = useThree((state) => state.size);
  const view = useBiologyView();
  const framing = use(FramingContext);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? view.narrowCameraPosition
    : view.cameraPosition;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={view.cameraTarget}
      fov={45}
      framing={framing}
      orbitOnPlay
      resetKey={selectedIndex}
    />
  );
}
