import { useMediaQuery } from "@mantine/hooks";
import { useThree } from "@react-three/fiber";
import {
  CATHODE_RAY_MODE_ID,
  getSubatomicSceneColors,
  isSubatomicParticlesModeId,
  SUBATOMIC_PARTICLE_MODE_IDS,
  SUBATOMIC_VIEW_CONFIG,
  type SubatomicParticlesModeId,
} from "@repo/design-system/components/contents/chemistry/subatomic-particles/data";
import {
  SubatomicParticlesScene,
  SubatomicParticlesSceneProvider,
} from "@repo/design-system/components/contents/chemistry/subatomic-particles/scene";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useState } from "react";
import { useTranslations } from "use-intl";

const NARROW_CANVAS_ASPECT_RATIO = 1.4;

export interface SubatomicParticlesLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseMode: string;
    modes: Record<
      SubatomicParticlesModeId,
      {
        description: NonNullable<ReactNode>;
        facts: readonly {
          label: string;
          value: ReactNode;
        }[];
        tab: string;
      }
    >;
    scene: {
      alphaParticle: ReactNode;
      anode: ReactNode;
      cathode: ReactNode;
      cathodeRay: ReactNode;
      negativePlate: ReactNode;
      nucleus: ReactNode;
      positivePlate: ReactNode;
    };
  };
  title: NonNullable<ReactNode>;
}

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
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const useVerticalToggle = useMediaQuery(
    TAILWIND_MEDIA_QUERIES.belowSm,
    false
  );
  const [selectedModeId, setSelectedModeId] =
    useState<SubatomicParticlesModeId>(CATHODE_RAY_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const t = useTranslations("Common");
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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMode}
          className="w-full"
          onValueChange={handleModeChange}
          orientation={toggleOrientation}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {Arr.map(SUBATOMIC_PARTICLE_MODE_IDS, (modeId) => (
            <ToggleGroupItem key={modeId} value={modeId}>
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody className={threeSceneFrameVariants()}>
        <ScienceStage>
          <Suspense>
            <SubatomicCameraControls viewConfig={viewConfig} />
            <SubatomicParticlesSceneProvider
              colors={sceneColors}
              labels={labels.scene}
            >
              <SubatomicParticlesScene modeId={selectedModeId} />
            </SubatomicParticlesSceneProvider>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.description} />
          {Arr.map(selectedLabels.facts, (fact) => (
            <VisualFact
              key={fact.label}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
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
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? viewConfig.narrowCameraPosition
    : viewConfig.cameraPosition;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={viewConfig.cameraTarget}
      fov={45}
      framing="content"
    />
  );
}
