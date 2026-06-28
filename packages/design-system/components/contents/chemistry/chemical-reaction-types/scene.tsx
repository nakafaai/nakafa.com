import type {
  ChemicalReactionTypeId,
  ChemicalReactionTypeSceneColors,
  ChemicalReactionTypesLabLabels,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { ReactionModel } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/models";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const BEFORE_X = -1.18;
const AFTER_X = 1.18;
const SCENE_SCALE = 1.28;

type ReactionPhase = "after" | "before";

export function ChemicalReactionTypesScene({
  colors,
  labels,
  typeId,
}: {
  colors: ChemicalReactionTypeSceneColors;
  labels: ChemicalReactionTypesLabLabels;
  typeId: ChemicalReactionTypeId;
}) {
  return (
    <group position={[0, -0.08, 0]} scale={SCENE_SCALE}>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[BEFORE_X, 0.74, 0.16]}
      >
        {labels.before}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[AFTER_X, 0.74, 0.16]}
      >
        {labels.after}
      </SceneLabel>
      <ReactionStage
        colors={colors}
        phase="before"
        typeId={typeId}
        x={BEFORE_X}
      />

      <ReactionStage
        colors={colors}
        phase="after"
        typeId={typeId}
        x={AFTER_X}
      />
    </group>
  );
}

function ReactionStage({
  colors,
  phase,
  typeId,
  x,
}: {
  colors: ChemicalReactionTypeSceneColors;
  phase: ReactionPhase;
  typeId: ChemicalReactionTypeId;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <ReactionModel colors={colors} phase={phase} typeId={typeId} />
    </group>
  );
}
