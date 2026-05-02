"use client";

import { useThree } from "@react-three/fiber";
import {
  ATOM_MODE_ID,
  getMatterParticleSceneColors,
  isMatterParticleModeId,
  MATTER_PARTICLE_MODE_IDS,
  MATTER_PARTICLE_SCENE_VIEW,
  type MatterParticleModeId,
  type MatterParticleReaderLabProps,
} from "@repo/design-system/components/contents/chemistry/matter-particle-reader/data";
import { MatterParticleReaderScene } from "@repo/design-system/components/contents/chemistry/matter-particle-reader/scene";
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
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

/**
 * Renders a compact 3D reader for atom, element, and molecule categories.
 */
export function MatterParticleReaderLab({
  title,
  description,
  labels,
}: MatterParticleReaderLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedModeId, setSelectedModeId] =
    useState<MatterParticleModeId>(ATOM_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const sceneColors = getMatterParticleSceneColors(resolvedTheme);

  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isMatterParticleModeId(value)) {
      return;
    }

    setSelectedModeId(value);
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
          className="grid w-full grid-cols-2 sm:grid-cols-4"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {MATTER_PARTICLE_MODE_IDS.map((modeId) => (
            <ToggleGroupItem
              aria-label={labels.modes[modeId].tabLabel}
              key={modeId}
              value={modeId}
            >
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.particleView}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: 43,
              position: MATTER_PARTICLE_SCENE_VIEW.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <MatterParticleCameraControls />
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.bond}
                intensity={0.62}
              />
              <directionalLight intensity={1.25} position={[4, 5, 5]} />
              <MatterParticleReaderScene
                colors={sceneColors}
                modeId={selectedModeId}
              />
            </Suspense>
          </ThreeCanvas>
        </section>

        <p className="text-muted-foreground text-sm">
          {selectedLabels.helperCaption}
        </p>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact
            label={labels.categoryLabel}
            value={selectedLabels.category}
          />
          <LabFact label={labels.readingLabel} value={selectedLabels.reading} />
        </dl>
      </CardFooter>
    </Card>
  );
}

function MatterParticleCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? MATTER_PARTICLE_SCENE_VIEW.narrowCameraPosition
    : MATTER_PARTICLE_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={MATTER_PARTICLE_SCENE_VIEW.cameraTarget}
      maxDistance={8.4}
      minDistance={2.6}
    />
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
