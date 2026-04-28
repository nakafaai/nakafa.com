"use client";

import type {
  MeasurementToolId,
  MeasurementToolsLabProps,
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

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
  const selectedReading = formatMeasurement(
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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseTool}
          className="grid w-full grid-cols-3"
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

        <div className="relative aspect-16/10 overflow-hidden rounded-md bg-card">
          <ThreeCanvas
            camera={{ fov: 45, position: viewConfig.cameraPosition }}
            frameloop="demand"
          >
            <Suspense>
              <CameraControls
                autoRotate={false}
                cameraPosition={viewConfig.cameraPosition}
                cameraTarget={viewConfig.cameraTarget}
              />
              <ambientLight intensity={0.75} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.65}
              />
              <directionalLight intensity={1.35} position={[5, 8, 6]} />
              <MeasurementScene
                colors={sceneColors}
                measurement={selectedMeasurement}
                reading={selectedReading.scene}
                selectedToolId={selectedToolId}
              />
            </Suspense>
          </ThreeCanvas>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div>{selectedLabels.control}</div>
            </div>
            <div className="shrink-0 tabular-nums">
              <InlineMath math={selectedReading.math} />
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
      </CardContent>
      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <ToolFact
            label={labels.instrument}
            value={selectedLabels.instrument}
          />
          <ToolFact
            label={labels.measuredObject}
            value={selectedLabels.object}
          />
          <ToolFact
            label={labels.reading}
            value={<InlineMath math={selectedReading.math} />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Renders one compact label-value fact without badge styling.
 */
function ToolFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
