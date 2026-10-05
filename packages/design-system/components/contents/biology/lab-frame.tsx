"use client";

import { useThree } from "@react-three/fiber";
import {
  BIOLOGY_DEFAULT_VIEW,
  type BiologyLabItem,
  type BiologyLabProps,
  type BiologySceneProps,
  type BiologySceneView,
  getBiologySceneColors,
  isBiologyItemIndex,
} from "@repo/design-system/components/contents/biology/data";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { cn } from "cn";
import { useTheme } from "next-themes";
import type { ComponentType, ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.3;

/**
 * Renders the shared card, controls, and camera frame for one biology 3D lab.
 */
export function BiologyLabFrame<Item extends BiologyLabItem>({
  description,
  labels,
  scene: Scene,
  title,
  view = BIOLOGY_DEFAULT_VIEW,
}: BiologyLabProps<Item> & {
  scene: ComponentType<BiologySceneProps<Item>>;
  view?: BiologySceneView;
}) {
  const { resolvedTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const colors = getBiologySceneColors(resolvedTheme);
  const selectedItem = labels.items[selectedIndex];
  const hasMultipleItems = labels.items.length > 1;

  /**
   * Keeps one tab active when ToggleGroup emits an empty value.
   */
  function handleItemChange(value: string) {
    if (!value) {
      return;
    }

    if (!isBiologyItemIndex(value, labels.items)) {
      return;
    }

    setSelectedIndex(Number(value));
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        {hasMultipleItems && (
          <ToggleGroup
            aria-label={labels.chooseMode}
            gridColumns="auto"
            onValueChange={handleItemChange}
            type="single"
            value={String(selectedIndex)}
            variant="outline"
          >
            {labels.items.map((item, index) => (
              <ToggleGroupItem key={item.tab} value={String(index)}>
                {item.tab}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <ResponsiveBiologyCamera key={selectedIndex} view={view} />
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
              <Scene
                colors={colors}
                item={selectedItem}
                selectedIndex={selectedIndex}
              />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>

        <p className="text-muted-foreground text-sm">{selectedItem.caption}</p>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <BiologyFact label={labels.focusLabel} value={selectedItem.focus} />
          <BiologyFact
            label={labels.takeawayLabel}
            value={selectedItem.takeaway}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Keeps the active biology scene framed on narrow and wide canvases.
 */
function ResponsiveBiologyCamera({ view }: { view: BiologySceneView }) {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? view.narrowCameraPosition
    : view.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={view.cameraTarget}
      fov={45}
    />
  );
}

/**
 * Renders one footer fact in the same visual rhythm as physics and chemistry labs.
 */
function BiologyFact({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
