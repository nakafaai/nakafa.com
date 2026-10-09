"use client";

import { useThree } from "@react-three/fiber";
import type {
  MeasurementToolId,
  MeasurementToolsLabLabels,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import {
  createInitialMeasurements,
  formatMeasurement,
  getSceneColors,
  isMeasurementToolId,
  LENGTH_TOOL_ID,
  MASS_TOOL_ID,
  MEASUREMENT_CONTROLS,
  normalizeMeasurement,
  TIME_TOOL_ID,
  TOOL_VIEW_CONFIG,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import { MeasurementScene } from "@repo/design-system/components/contents/physics/measurement/tools/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.4;

interface MeasurementToolsLabProps {
  description: ReactNode;
  labels: MeasurementToolsLabLabels;
  title: ReactNode;
}

/**
 * Renders an interactive 3D lab for grade 10 measurement tools.
 *
 * WebGL stays inside the shared ThreeCanvas client boundary, while the static
 * MDX page around it can still render on the server. The canvas uses
 * `frameloop="demand"` because these scenes update only after user input or
 * camera movement.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance
 * @see https://nextjs.org/docs/app/getting-started/server-and-client-components
 */
export function MeasurementToolsLab({
  title,
  description,
  labels,
}: MeasurementToolsLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedToolId, setSelectedToolId] =
    useState<MeasurementToolId>(LENGTH_TOOL_ID);
  const [measurements, setMeasurements] = useState(createInitialMeasurements);
  const selectedLabels = labels.tools[selectedToolId];
  const selectedControl = MEASUREMENT_CONTROLS[selectedToolId];
  const selectedMeasurement = measurements[selectedToolId];
  const selectedReadingMath = formatMeasurement(
    selectedMeasurement,
    selectedControl,
    labels.decimalSeparator
  );
  const sceneColors = getSceneColors(resolvedTheme);
  const viewConfig = TOOL_VIEW_CONFIG[selectedToolId];

  /**
   * Keeps one instrument selected when ToggleGroup emits an empty value.
   */
  function handleToolChange(value: string) {
    if (!value) {
      return;
    }

    if (!isMeasurementToolId(value)) {
      return;
    }

    setSelectedToolId(value);
  }

  /**
   * Keeps the slider value aligned with the selected instrument precision.
   */
  function handleMeasurementChange(nextMeasurement: number) {
    setMeasurements((currentMeasurements) => ({
      ...currentMeasurements,
      [selectedToolId]: normalizeMeasurement(nextMeasurement, selectedControl),
    }));
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseTool}
          gridColumns="3"
          onValueChange={handleToolChange}
          type="single"
          value={selectedToolId}
          variant="outline"
        >
          <ToggleGroupItem value={LENGTH_TOOL_ID}>
            {labels.tools.length.tab}
          </ToggleGroupItem>
          <ToggleGroupItem value={MASS_TOOL_ID}>
            {labels.tools.mass.tab}
          </ToggleGroupItem>
          <ToggleGroupItem value={TIME_TOOL_ID}>
            {labels.tools.time.tab}
          </ToggleGroupItem>
        </ToggleGroup>

        <VisualCardScene className={threeSceneFrameVariants()}>
          <ThreeCanvas frameloop="demand">
            <Suspense>
              <ResponsiveMeasurementCamera viewConfig={viewConfig} />
              <ambientLight intensity={0.75} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.65}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[5, 8, 6]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <MeasurementScene
                colors={sceneColors}
                measurement={selectedMeasurement}
                reading={<InlineMath math={selectedReadingMath} />}
                selectedToolId={selectedToolId}
              />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <div>{selectedLabels.control}</div>
            </div>
            <div className="shrink-0 tabular-nums">
              <InlineMath math={selectedReadingMath} />
            </div>
          </div>
          <Slider
            aria-label={selectedLabels.control}
            max={selectedControl.max}
            min={selectedControl.min}
            onValueChange={handleMeasurementChange}
            step={selectedControl.step}
            value={selectedMeasurement}
          />
        </div>
      </VisualCardBody>
      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <VisualFact
            label={labels.instrument}
            value={selectedLabels.instrument}
          />
          <VisualFact
            label={labels.measuredObject}
            value={selectedLabels.object}
          />
          <VisualFact
            label={labels.reading}
            value={<InlineMath math={selectedReadingMath} />}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Keeps each instrument framed when the shared 3D frame becomes square on
 * mobile screens.
 */
function ResponsiveMeasurementCamera({
  viewConfig,
}: {
  viewConfig: (typeof TOOL_VIEW_CONFIG)[MeasurementToolId];
}) {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? viewConfig.narrowCameraPosition
    : viewConfig.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={viewConfig.cameraTarget}
      fov={45}
      framing="content"
    />
  );
}
