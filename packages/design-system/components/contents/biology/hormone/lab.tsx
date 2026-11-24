import type { PhytohormoneId } from "@repo/design-system/components/contents/biology/hormone/model";
import { PhytohormoneScene } from "@repo/design-system/components/contents/biology/hormone/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function PhytohormoneActionLab({
  description,
  hormones,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly hormones: readonly [PhytohormoneId, ...PhytohormoneId[]];
  readonly labels: {
    readonly effect?: ReactNode;
    readonly farmUse?: ReactNode;
    readonly hormone: string;
    readonly hormones: Readonly<
      Partial<
        Record<
          PhytohormoneId,
          {
            readonly effect: ReactNode;
            readonly farmUse: ReactNode;
            readonly name: string;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"fruit" | "lateralBud" | "leaf" | "shootTip" | "stemNode", string>
    >;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PhytohormoneId>(hormones[0]);
  const active = Arr.contains(hormones, selected) ? selected : hormones[0];
  const copy = labels.hormones[active];
  const color = Match.value(active).pipe(
    Match.when("auxin", () => BOTANY_COLORS.auxinDot),
    Match.when("gibberellin", () => BOTANY_COLORS.healthyLeaf),
    Match.when("cytokinin", () => BOTANY_COLORS.windGreen),
    Match.when("abscisicAcid", () => BOTANY_COLORS.chlorosisYellow),
    Match.when("ethylene", () => BOTANY_COLORS.fruitRed),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(hormones[0]);
        }}
      />

      {hormones.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.hormone}
            gridColumns={toggleColumns(hormones.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(hormones, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(hormones, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.hormones[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <PhytohormoneScene hormone={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.hormone}
            value={copy?.name ?? active}
          />
          {labels.effect === undefined || copy === undefined ? null : (
            <VisualFact label={labels.effect} value={copy.effect} />
          )}
          {labels.farmUse === undefined || copy === undefined ? null : (
            <VisualFact label={labels.farmUse} value={copy.farmUse} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
