"use client";

import { useThree } from "@react-three/fiber";
import {
  BIOLOGY_DEFAULT_VIEW,
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { cn } from "@repo/design-system/lib/utils";
import { useTheme } from "next-themes";
import type { ComponentType, ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.3;

/**
 * Renders the shared card, controls, and camera frame for one biology 3D lab.
 */
export function BiologyLabFrame({
  description,
  labels,
  scene: Scene,
  title,
  view = BIOLOGY_DEFAULT_VIEW,
}: BiologyLabProps & {
  scene: ComponentType<BiologySceneProps>;
  view?: BiologySceneView;
}) {
  const { resolvedTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const colors = getBiologySceneColors(resolvedTheme);
  const selectedItem = labels.items[selectedIndex];

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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseMode}
          className="grid w-full grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]"
          layout="grid"
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

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas camera={{ fov: 45, position: view.cameraPosition }}>
            <Suspense>
              <ResponsiveBiologyCamera view={view} />
              <ambientLight intensity={0.78} />
              <hemisphereLight
                color={colors.skyLight}
                groundColor={colors.soil}
                intensity={0.62}
              />
              <directionalLight intensity={1.25} position={[5, 6, 5]} />
              <Scene
                colors={colors}
                item={selectedItem}
                selectedIndex={selectedIndex}
              />
            </Suspense>
          </ThreeCanvas>
        </section>

        <p className="text-muted-foreground text-sm">{selectedItem.caption}</p>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <BiologyFact
            label={labels.structureLabel}
            value={selectedItem.structure}
          />
          <BiologyFact label={labels.detailLabel} value={selectedItem.detail} />
          <BiologyFact
            className="sm:col-span-2"
            label={labels.sourceNoteLabel}
            value={labels.sourceNote}
          />
        </dl>
      </CardFooter>
    </Card>
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
      maxDistance={9.4}
      minDistance={2.4}
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
