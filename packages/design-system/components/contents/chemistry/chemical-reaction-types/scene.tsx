import type {
  ChemicalReactionTypeId,
  ChemicalReactionTypeSceneColors,
  ChemicalReactionTypesLabLabels,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { ReactionModel } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/models";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const BEFORE_X = -1.18;
const AFTER_X = 1.18;
const STAGE_LABEL_Y = 1.16;
const SCENE_SCALE = 1.28;

type ReactionPhase = "after" | "before";

export function ChemicalReactionTypesScene({
  colors,
  labels,
  typeId,
}: {
  colors: ChemicalReactionTypeSceneColors;
  labels: Pick<ChemicalReactionTypesLabLabels, "after" | "before">;
  typeId: ChemicalReactionTypeId;
}) {
  return (
    <group position={[0, -0.08, 0]} scale={SCENE_SCALE}>
      <ReactionStage
        colors={colors}
        label={labels.before}
        phase="before"
        typeId={typeId}
        x={BEFORE_X}
      />

      <ArrowHelper
        arrowSize={0.14}
        color={colors.arrow}
        from={[-0.34, 0.02, 0.04]}
        lineWidth={3}
        to={[0.34, 0.02, 0.04]}
      />

      <ReactionStage
        colors={colors}
        label={labels.after}
        phase="after"
        typeId={typeId}
        x={AFTER_X}
      />
    </group>
  );
}

function ReactionStage({
  colors,
  label,
  phase,
  typeId,
  x,
}: {
  colors: ChemicalReactionTypeSceneColors;
  label: string;
  phase: ReactionPhase;
  typeId: ChemicalReactionTypeId;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, STAGE_LABEL_Y, 0.2]}
      >
        {label}
      </SceneLabel>
      <ReactionModel colors={colors} phase={phase} typeId={typeId} />
    </group>
  );
}
