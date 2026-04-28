"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useThree } from "@react-three/fiber";
import {
  CATHODE_RAY_MODE_ID,
  getSubatomicSceneColors,
  isSubatomicParticlesModeId,
  SUBATOMIC_PARTICLE_MODE_IDS,
  SUBATOMIC_VIEW_CONFIG,
  type SubatomicParticlesFact,
  type SubatomicParticlesLabProps,
  type SubatomicParticlesModeId,
} from "@repo/design-system/components/contents/chemistry/subatomic-particles/data";
import { SubatomicParticlesScene } from "@repo/design-system/components/contents/chemistry/subatomic-particles/scene";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { useTheme } from "next-themes";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.4;

/**
 * Renders one theme-aware 3D lab for the evidence behind electrons, nuclei,
 * protons, and neutrons.
 *
 * @see https://r3f.docs.pmnd.rs/api/canvas
 * @see https://drei.docs.pmnd.rs/controls/orbit-controls
 */
export function SubatomicParticlesLab({
  title,
  description,
  labels,
}: SubatomicParticlesLabProps) {
  const { resolvedTheme } = useTheme();
  const useVerticalToggle = useMediaQuery(
    TAILWIND_MEDIA_QUERIES.belowSm,
    false,
    { getInitialValueInEffect: false }
  );
  const [selectedModeId, setSelectedModeId] =
    useState<SubatomicParticlesModeId>(CATHODE_RAY_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const sceneColors = getSubatomicSceneColors(resolvedTheme);
  const viewConfig = SUBATOMIC_VIEW_CONFIG[selectedModeId];
  const toggleOrientation = useVerticalToggle ? "vertical" : "horizontal";

  /**
   * Keeps one mode selected when ToggleGroup emits an empty value.
   */
  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isSubatomicParticlesModeId(value)) {
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
          className="w-full max-sm:flex-col max-sm:items-stretch"
          onValueChange={handleModeChange}
          orientation={toggleOrientation}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {SUBATOMIC_PARTICLE_MODE_IDS.map((modeId) => (
            <ToggleGroupItem
              className="max-sm:w-full max-sm:flex-none max-sm:border-t-0 max-sm:border-l max-sm:last:rounded-r-none max-sm:last:rounded-b-md max-sm:first:rounded-t-md max-sm:first:rounded-l-none max-sm:first:border-t"
              key={modeId}
              value={modeId}
            >
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="relative aspect-16/10 overflow-hidden rounded-md bg-card">
          <ThreeCanvas
            camera={{ fov: 45, position: viewConfig.cameraPosition }}
          >
            <Suspense>
              <SubatomicCameraControls viewConfig={viewConfig} />
              <ambientLight intensity={0.75} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.65}
              />
              <directionalLight intensity={1.35} position={[4, 6, 5]} />
              <SubatomicParticlesScene
                colors={sceneColors}
                labels={labels.scene}
                modeId={selectedModeId}
              />
            </Suspense>
          </ThreeCanvas>
        </div>

        <div className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
          {selectedLabels.description}
        </div>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {selectedLabels.facts.map((fact) => (
            <LabFact fact={fact} key={fact.label} />
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function LabFact({ fact }: { fact: SubatomicParticlesFact }) {
  return (
    <div className="flex min-h-12 min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{fact.label}</dt>
      <dd className="wrap-break-word text-foreground">
        <FactValue fact={fact} />
      </dd>
    </div>
  );
}

/**
 * Renders mathematical facts with the site math renderer and plain facts as
 * compact body text.
 */
function FactValue({ fact }: { fact: SubatomicParticlesFact }) {
  if (fact.math) {
    return <InlineMath math={fact.value} />;
  }

  return <span className="text-sm">{fact.value}</span>;
}

/**
 * Uses the canvas aspect ratio to keep every scene readable on narrow screens
 * without changing the card layout or requiring manual zoom.
 */
function SubatomicCameraControls({
  viewConfig,
}: {
  viewConfig: (typeof SUBATOMIC_VIEW_CONFIG)[SubatomicParticlesModeId];
}) {
  const size = useThree((state) => state.size);
  const cameraPosition =
    size.width < size.height * NARROW_CANVAS_ASPECT_RATIO
      ? viewConfig.narrowCameraPosition
      : viewConfig.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={viewConfig.cameraTarget}
    />
  );
}
