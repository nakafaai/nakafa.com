import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  CatalystState,
  ReactionEnthalpy,
} from "@repo/design-system/components/contents/chemistry/catalyst/model";
import { evaluateCatalyst } from "@repo/design-system/components/contents/chemistry/catalyst/model";
import { CatalystPathwayScene } from "@repo/design-system/components/contents/chemistry/catalyst/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const CATALYST_STATES: readonly [CatalystState, CatalystState] = [
  "absent",
  "present",
];

export function CatalystPathwayLab({
  description,
  labels,
  reactions,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly activationEnergy?: ReactNode;
    readonly catalyst: string;
    readonly catalystStates: Readonly<Record<CatalystState, string>>;
    readonly enthalpyChange?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "catalysedPeak"
        | "catalystSurface"
        | "productLevel"
        | "reactantLevel"
        | "uncatalysedPeak",
        string
      >
    >;
    readonly pathway: ReactNode;
    readonly reaction: string;
    readonly reactions: Readonly<Partial<Record<ReactionEnthalpy, string>>>;
    readonly view: string;
  };
  readonly reactions: readonly [ReactionEnthalpy, ...ReactionEnthalpy[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedReaction, setSelectedReaction] = useState<ReactionEnthalpy>(
    reactions[0]
  );
  const [catalyst, setCatalyst] = useState<CatalystState>("absent");
  const quantity = useQuantity();

  const activeReaction = Arr.contains(reactions, selectedReaction)
    ? selectedReaction
    : reactions[0];
  const profile = evaluateCatalyst(activeReaction, catalyst);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedReaction(reactions[0]);
          setCatalyst("absent");
        }}
      />

      <VisualCardToolbar>
        {reactions.length > 1 ? (
          <ToggleGroup
            aria-label={labels.reaction}
            gridColumns={toggleColumns(reactions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(reactions, (item) => item === next),
                setSelectedReaction
              );
            }}
            type="single"
            value={activeReaction}
            variant="outline"
          >
            {Arr.map(reactions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.reactions[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <ToggleGroup
          aria-label={labels.catalyst}
          gridColumns={toggleColumns(CATALYST_STATES.length)}
          onValueChange={(next: string) => {
            Option.map(
              Arr.findFirst(CATALYST_STATES, (item) => item === next),
              setCatalyst
            );
          }}
          type="single"
          value={catalyst}
          variant="outline"
        >
          {Arr.map(CATALYST_STATES, (id) => (
            <ToggleGroupItem key={id} value={id}>
              {labels.catalystStates[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.95} setting="lab">
          <Suspense fallback={null}>
            <CatalystPathwayScene
              catalyst={catalyst}
              parts={labels.parts}
              reaction={activeReaction}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              catalyst === "present"
                ? KINETICS_COLORS.catalysedPath
                : KINETICS_COLORS.uncatalysedPath
            }
            label={labels.pathway}
            value={labels.catalystStates[catalyst]}
          />
          {labels.activationEnergy === undefined ? null : (
            <VisualFactTabular
              label={labels.activationEnergy}
              value={
                <InlineMath
                  math={quantity(
                    profile.activationEnergyKj,
                    "\\text{ kJ mol}^{-1}",
                    0
                  )}
                />
              }
            />
          )}
          {labels.enthalpyChange === undefined ? null : (
            <VisualFactTabular
              label={labels.enthalpyChange}
              value={
                <InlineMath
                  math={quantity(
                    profile.enthalpyChangeKj,
                    "\\text{ kJ mol}^{-1}",
                    0
                  )}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
