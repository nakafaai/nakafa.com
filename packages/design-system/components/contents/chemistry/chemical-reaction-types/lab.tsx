import { useThree } from "@react-three/fiber";
import {
  ChemicalReactionTypeSceneProvider,
  createChemicalReactionTypeStore,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import {
  CHEMICAL_REACTION_TYPE_IDS,
  CHEMICAL_REACTION_TYPES_SCENE_VIEW,
  type ChemicalReactionTypeId,
  COMBUSTION_TYPE_ID,
  getChemicalReactionTypeSceneColors,
  isChemicalReactionTypeId,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { ChemicalReactionTypesScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/scene";
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
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";

const NARROW_CANVAS_ASPECT_RATIO = 1.25;

interface ChemicalReactionTypesLabProps {
  description: ReactNode;
  labels: {
    after: string;
    before: string;
    checkLabel: string;
    chooseType: string;
    equationLabel: string;
    reactionView: string;
    readingLabel: string;
    types: Record<
      ChemicalReactionTypeId,
      {
        check: ReactNode;
        equation: ReactNode;
        helperCaption: ReactNode;
        reading: ReactNode;
        tab: string;
        visibleCue: ReactNode;
      }
    >;
    visibleCueLabel: string;
  };
  title: ReactNode;
}

/**
 * Renders an interactive 3D reader for common chemical reaction types.
 */
export function ChemicalReactionTypesLab({
  title,
  description,
  labels,
}: ChemicalReactionTypesLabProps) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [store] = useState(() =>
    createChemicalReactionTypeStore(COMBUSTION_TYPE_ID)
  );
  const selectedTypeId = useStore(store, (state) => state.typeId);
  const selectType = useStore(store, (state) => state.selectType);
  const selectedLabels = labels.types[selectedTypeId];
  const t = useTranslations("Common");
  const sceneColors = useMemo(
    () => getChemicalReactionTypeSceneColors(resolvedTheme),
    [resolvedTheme]
  );

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

    selectType(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseType}
          gridColumns="4"
          onValueChange={handleTypeChange}
          type="single"
          value={selectedTypeId}
          variant="outline"
        >
          {Arr.map(CHEMICAL_REACTION_TYPE_IDS, (typeId) => (
            <ToggleGroupItem key={typeId} value={typeId}>
              {labels.types[typeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.reactionView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always" setting="lab">
          <Suspense>
            <ReactionTypeCameraControls />
            <ChemicalReactionTypeSceneProvider
              colors={sceneColors}
              store={store}
            >
              <ChemicalReactionTypesScene labels={labels} />
            </ChemicalReactionTypeSceneProvider>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.helperCaption} />
          <VisualFact
            label={labels.equationLabel}
            value={selectedLabels.equation}
          />
          <VisualFact
            label={labels.visibleCueLabel}
            value={selectedLabels.visibleCue}
          />
          <VisualFact
            label={labels.readingLabel}
            value={selectedLabels.reading}
          />
          <VisualFact label={labels.checkLabel} value={selectedLabels.check} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
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
      cameraPosition={cameraPosition}
      cameraTarget={CHEMICAL_REACTION_TYPES_SCENE_VIEW.cameraTarget}
      fov={45}
      framing="content"
    />
  );
}
