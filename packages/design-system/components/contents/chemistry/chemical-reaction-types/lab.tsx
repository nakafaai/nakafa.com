"use client";

import { useThree } from "@react-three/fiber";
import {
  CHEMICAL_REACTION_TYPE_IDS,
  CHEMICAL_REACTION_TYPES_SCENE_VIEW,
  type ChemicalReactionTypeId,
  type ChemicalReactionTypesLabProps,
  COMBUSTION_TYPE_ID,
  getChemicalReactionTypeSceneColors,
  isChemicalReactionTypeId,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { ChemicalReactionTypesScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/scene";
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

const NARROW_CANVAS_ASPECT_RATIO = 1.25;

/**
 * Renders an interactive 3D reader for common chemical reaction types.
 */
export function ChemicalReactionTypesLab({
  title,
  description,
  labels,
}: ChemicalReactionTypesLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedTypeId, setSelectedTypeId] =
    useState<ChemicalReactionTypeId>(COMBUSTION_TYPE_ID);
  const selectedLabels = labels.types[selectedTypeId];
  const sceneColors = getChemicalReactionTypeSceneColors(resolvedTheme);

  /**
   * Keeps one reaction type selected when ToggleGroup emits an empty value.
   */
  function handleTypeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isChemicalReactionTypeId(value)) {
      return;
    }

    setSelectedTypeId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseType}
          className="grid w-full grid-cols-2 sm:grid-cols-4"
          layout="grid"
          onValueChange={handleTypeChange}
          type="single"
          value={selectedTypeId}
          variant="outline"
        >
          {CHEMICAL_REACTION_TYPE_IDS.map((typeId) => (
            <ToggleGroupItem key={typeId} value={typeId}>
              {labels.types[typeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.reactionView}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: 45,
              position: CHEMICAL_REACTION_TYPES_SCENE_VIEW.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ReactionTypeCameraControls />
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.7}
              />
              <directionalLight intensity={1.3} position={[4, 5, 5]} />
              <pointLight
                color={sceneColors.flame}
                intensity={0.8}
                position={[1.8, 1.2, 1.6]}
              />
              <ChemicalReactionTypesScene
                colors={sceneColors}
                labels={labels}
                typeId={selectedTypeId}
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
          <ReactionTypeFact
            label={labels.equationLabel}
            value={selectedLabels.equation}
          />
          <ReactionTypeFact
            label={labels.visibleCueLabel}
            value={selectedLabels.visibleCue}
          />
          <ReactionTypeFact
            label={labels.readingLabel}
            value={selectedLabels.reading}
          />
          <ReactionTypeFact
            label={labels.checkLabel}
            value={selectedLabels.check}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Keeps the paired reaction model framed on narrow and wide canvases.
 */
function ReactionTypeCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? CHEMICAL_REACTION_TYPES_SCENE_VIEW.narrowCameraPosition
    : CHEMICAL_REACTION_TYPES_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={CHEMICAL_REACTION_TYPES_SCENE_VIEW.cameraTarget}
      maxDistance={9.5}
      minDistance={2.8}
    />
  );
}

/**
 * Renders one compact footer fact for the selected reaction type.
 */
function ReactionTypeFact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
