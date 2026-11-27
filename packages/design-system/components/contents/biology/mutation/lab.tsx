import type { MutationKind } from "@repo/design-system/components/contents/biology/mutation/model";
import { ChromosomeMutationScene } from "@repo/design-system/components/contents/biology/mutation/scene";
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
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function ChromosomeMutationLab({
  description,
  labels,
  mutations,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly change?: ReactNode;
    readonly effect?: ReactNode;
    readonly mutation: string;
    readonly mutations: Readonly<
      Partial<
        Record<
          MutationKind,
          {
            readonly change: ReactNode;
            readonly effect: ReactNode;
            readonly name: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"brokenSegment" | "centromere" | "extraCopy" | "normalArm", string>
    >;
    readonly view: string;
  };
  readonly mutations: readonly [MutationKind, ...MutationKind[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<MutationKind>(mutations[0]);
  const active = Arr.contains(mutations, selected) ? selected : mutations[0];
  const copy = labels.mutations[active];
  const color = Match.value(active).pipe(
    Match.when("deletion", () => GENETICS_COLORS.brokenHighlight),
    Match.when("duplication", () => GENETICS_COLORS.bandB),
    Match.when("inversion", () => GENETICS_COLORS.carrierAmber),
    Match.when("translocation", () => GENETICS_COLORS.bandD),
    Match.when("nondisjunction", () => GENETICS_COLORS.extraCopyPurple),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(mutations[0]);
        }}
      />

      {mutations.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.mutation}
            gridColumns={toggleColumns(mutations.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(mutations, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(mutations, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.mutations[id]?.name ?? id}
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
            <ChromosomeMutationScene mutation={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.mutation}
            value={copy?.name ?? active}
          />
          {labels.change === undefined || copy === undefined ? null : (
            <VisualFact label={labels.change} value={copy.change} />
          )}
          {labels.effect === undefined || copy === undefined ? null : (
            <VisualFact label={labels.effect} value={copy.effect} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
