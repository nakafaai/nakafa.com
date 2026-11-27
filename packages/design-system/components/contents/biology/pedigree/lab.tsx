import type { HumanPattern } from "@repo/design-system/components/contents/biology/pedigree/model";
import { PedigreeSexLinkedScene } from "@repo/design-system/components/contents/biology/pedigree/scene";
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

export function PedigreeSexLinkedLab({
  description,
  labels,
  patterns,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly parts: Readonly<
      Record<
        | "affected"
        | "carrier"
        | "female"
        | "male"
        | "xChromosome"
        | "yChromosome",
        string
      >
    >;
    readonly pattern: string;
    readonly patterns: Readonly<
      Partial<
        Record<
          HumanPattern,
          {
            readonly name: ReactNode;
            readonly risk: ReactNode;
            readonly rule: ReactNode;
          }
        >
      >
    >;
    readonly risk?: ReactNode;
    readonly rule?: ReactNode;
    readonly view: string;
  };
  readonly patterns: readonly [HumanPattern, ...HumanPattern[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<HumanPattern>(patterns[0]);
  const active = Arr.contains(patterns, selected) ? selected : patterns[0];
  const copy = labels.patterns[active];
  const color = Match.value(active).pipe(
    Match.when("aboBlood", () => GENETICS_COLORS.carrierAmber),
    Match.when("sexDetermination", () => GENETICS_COLORS.maleBlue),
    Match.when("xLinked", () => GENETICS_COLORS.affectedRed),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(patterns[0]);
        }}
      />

      {patterns.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.pattern}
            gridColumns={toggleColumns(patterns.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(patterns, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(patterns, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.patterns[id]?.name ?? id}
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
            <PedigreeSexLinkedScene parts={labels.parts} pattern={active} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={color}
            label={labels.pattern}
            value={copy?.name ?? active}
          />
          {labels.rule === undefined || copy === undefined ? null : (
            <VisualFact label={labels.rule} value={copy.rule} />
          )}
          {labels.risk === undefined || copy === undefined ? null : (
            <VisualFact label={labels.risk} value={copy.risk} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
