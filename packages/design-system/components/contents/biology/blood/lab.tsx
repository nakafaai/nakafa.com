import {
  clumpingAt,
  FINISH,
  readingAt,
} from "@repo/design-system/components/contents/biology/blood/run";
import {
  BloodScene,
  TileLabels,
} from "@repo/design-system/components/contents/biology/blood/scene";
import type {
  Group,
  Sample,
  Serum,
} from "@repo/design-system/components/contents/biology/blood/serology";
import {
  agglutinates,
  groupOf,
  rhesusSign,
  SERA,
} from "@repo/design-system/components/contents/biology/blood/serology";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * How far agglutination must have gone before the clumps show to the eye,
 * so the readout names a drop clumped only once it looks it.
 */
const VISIBLE = 0.2;

/**
 * The slide test for blood groups on a white porcelain tile: a drop of each
 * sample's blood in anti-A, anti-B and anti-D serum. Where an antibody meets
 * the antigen it is made against, it links the red cells into clumps in a
 * clear fluid; otherwise the drop stays an even red. The pattern of the three
 * drops names the group and the Rhesus factor.
 */
export function BloodTypingLab({
  description,
  labels,
  samples,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly clumped: ReactNode;
    readonly group?: ReactNode;
    readonly groups?: Readonly<Record<Group, ReactNode>>;
    readonly sample: string;
    readonly sera: Readonly<Record<Serum, ReactNode>>;
    readonly smooth: ReactNode;
    readonly time: ReactNode;
    readonly view: string;
  };
  readonly samples: readonly [Sample, ...Sample[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [chosen, setChosen] = useState(0);
  const [time, setTime] = useState(FINISH);
  const quantity = useQuantity();
  const sample = samples[chosen] ?? samples[0];
  const result = groupOf({
    a: agglutinates("a", sample),
    b: agglutinates("b", sample),
    d: agglutinates("d", sample),
  });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setChosen(0);
          setTime(FINISH);
        }}
      />

      {samples.length > 1 && (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.sample}
            gridColumns={toggleColumns(samples.length)}
            onValueChange={(value: string) => {
              if (value !== "") {
                setChosen(Number(value));
              }
            }}
            type="single"
            value={String(chosen)}
            variant="outline"
          >
            {Arr.map(samples, (each, index) => (
              <ToggleGroupItem key={each.name} value={String(index)}>
                {each.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.24} setting="lab">
          <Suspense fallback={null}>
            <BloodScene chosen={chosen} onTime={setTime} samples={samples}>
              <TileLabels
                chosen={chosen}
                names={Arr.map(samples, (each) => each.name)}
                sera={labels.sera}
              />
            </BloodScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(SERA, (serum, column) => (
            <VisualFactTabular
              key={serum}
              label={labels.sera[serum]}
              value={
                agglutinates(serum, sample) &&
                clumpingAt(time, column) >= VISIBLE
                  ? labels.clumped
                  : labels.smooth
              }
            />
          ))}
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath math={quantity(readingAt(time), "\\text{ s}", 0)} />
            }
          />
          {labels.group !== undefined && labels.groups !== undefined && (
            <VisualFactTabular
              label={labels.group}
              value={
                <span>
                  {labels.groups[result.group]}
                  {rhesusSign(result.rhesus)}
                </span>
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
