import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { HalogenPair } from "@repo/design-system/components/contents/chemistry/halogen/model";
import { HalogenDisplacementScene } from "@repo/design-system/components/contents/chemistry/halogen/scene";
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
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function HalogenDisplacementLab({
  description,
  labels,
  pairs,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly observation?: ReactNode;
    readonly pair: string;
    readonly pairs: Readonly<
      Partial<
        Record<
          HalogenPair,
          {
            readonly name: string;
            readonly observation: ReactNode;
            readonly redoxOutcome: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "aqueousLayer"
        | "halideIon"
        | "halogenDrop"
        | "organicLayer"
        | "testTube",
        string
      >
    >;
    readonly redoxOutcome?: ReactNode;
    readonly view: string;
  };
  readonly pairs: readonly [HalogenPair, ...HalogenPair[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<HalogenPair>(pairs[0]);
  const active = Arr.contains(pairs, selected) ? selected : pairs[0];
  const copy = labels.pairs[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(pairs[0]);
        }}
      />

      {pairs.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.pair}
            gridColumns={toggleColumns(pairs.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(pairs, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(pairs, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.pairs[id]?.name ?? id}
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
        <ScienceStage floor={0} reach={0.85} setting="lab">
          <Suspense fallback={null}>
            <HalogenDisplacementScene pair={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "i2WithKcl"
                ? PROCESS_COLORS.wasteSlate
                : PROCESS_COLORS.iodineViolet
            }
            label={labels.pair}
            value={copy?.name ?? active}
          />
          {labels.observation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.observation} value={copy.observation} />
          )}
          {labels.redoxOutcome === undefined || copy === undefined ? null : (
            <VisualFact label={labels.redoxOutcome} value={copy.redoxOutcome} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
