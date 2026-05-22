"use client";

import { useThree } from "@react-three/fiber";
import {
  BIOLOGY_SCENE_VIEW,
  type BiologyConceptId,
  type BiologyLabProps,
  getBiologySceneColors,
  isBiologyItemIndex,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyConceptScene } from "@repo/design-system/components/contents/biology/scene";
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
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.3;

/**
 * Renders the shared biology 3D card with one selected concept item.
 */
function BiologyConceptLab({
  conceptId,
  description,
  labels,
  title,
}: BiologyLabProps & { conceptId: BiologyConceptId }) {
  const { resolvedTheme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sceneColors = getBiologySceneColors(resolvedTheme);
  const selectedItem = labels.items[selectedIndex] ?? labels.items[0];

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
          className="grid w-full grid-cols-1 sm:grid-cols-3"
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
          <ThreeCanvas
            camera={{ fov: 45, position: BIOLOGY_SCENE_VIEW.cameraPosition }}
            frameloop="always"
          >
            <Suspense>
              <ResponsiveBiologyCamera />
              <ambientLight intensity={0.78} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.surface}
                intensity={0.62}
              />
              <directionalLight intensity={1.24} position={[5, 6, 5]} />
              <BiologyConceptScene
                colors={sceneColors}
                conceptId={conceptId}
                item={selectedItem}
              />
            </Suspense>
          </ThreeCanvas>
        </section>

        <p className="text-muted-foreground text-sm">{selectedItem.caption}</p>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{labels.structureLabel}</dt>
            <dd className="wrap-break-word text-foreground">
              {selectedItem.structure}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground">{labels.detailLabel}</dt>
            <dd className="wrap-break-word text-foreground">
              {selectedItem.detail}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <dt className="text-muted-foreground">{labels.sourceNoteLabel}</dt>
            <dd className="wrap-break-word text-foreground">
              {labels.sourceNote}
            </dd>
          </div>
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Keeps the selected biology scene framed on narrow and wide canvases.
 */
function ResponsiveBiologyCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? BIOLOGY_SCENE_VIEW.narrowCameraPosition
    : BIOLOGY_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={BIOLOGY_SCENE_VIEW.cameraTarget}
      maxDistance={9}
      minDistance={2.6}
    />
  );
}

/**
 * Renders the virus structure explorer.
 */
export function VirusStructureLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="virus-structure" {...props} />;
}

/**
 * Renders the viral reproduction stage explorer.
 */
export function VirusReplicationLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="virus-replication" {...props} />;
}

/**
 * Renders the viral role comparison explorer.
 */
export function VirusRoleLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="virus-role" {...props} />;
}

/**
 * Renders the virus spread prevention simulator.
 */
export function VirusPreventionLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="virus-prevention" {...props} />;
}

/**
 * Renders the biodiversity level comparison explorer.
 */
export function BiodiversityLevelsLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="biodiversity-levels" {...props} />;
}

/**
 * Renders the organism classification network explorer.
 */
export function ClassificationLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="classification" {...props} />;
}

/**
 * Renders the bacterial structure explorer.
 */
export function BacteriaStructureLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="bacteria" {...props} />;
}

/**
 * Renders the fungi growth explorer.
 */
export function FungiGrowthLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="fungi" {...props} />;
}

/**
 * Renders the ecosystem relationship explorer.
 */
export function EcosystemOrganismsLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="ecosystem" {...props} />;
}

/**
 * Renders the climate symptom indicator explorer.
 */
export function ClimateSymptomsLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="climate-symptoms" {...props} />;
}

/**
 * Renders the climate impact explorer.
 */
export function ClimateImpactLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="climate-impact" {...props} />;
}

/**
 * Renders the climate cause explorer.
 */
export function ClimateCauseLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="climate-causes" {...props} />;
}

/**
 * Renders the mitigation and adaptation action explorer.
 */
export function ClimateActionLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="climate-action" {...props} />;
}

/**
 * Renders the global climate cooperation explorer.
 */
export function ClimateCooperationLab(props: BiologyLabProps) {
  return <BiologyConceptLab conceptId="climate-cooperation" {...props} />;
}
