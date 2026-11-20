import type { Stage } from "@repo/design-system/components/contents/biology/fertilisation/gametes";
import {
  pollinationNeeds,
  seedChromosomes,
  stageAt,
} from "@repo/design-system/components/contents/biology/fertilisation/gametes";
import { FertilisationScene } from "@repo/design-system/components/contents/biology/fertilisation/scene";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/**
 * Double fertilisation in a flower cut lengthwise. The lesson names how many
 * chromosomes the body cells of the mother and father plants hold; the lab
 * halves them for the gametes and adds them up for the embryo, the endosperm
 * and the seed coat as the pollen tube delivers its two male gametes. With a
 * number of ovules, it also counts the pollen grains and male gametes it
 * takes to turn them all into seeds.
 */
export function FertilisationLab({
  description,
  father,
  labels,
  mother,
  ovules,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly father: number;
  readonly labels: {
    readonly embryo: ReactNode;
    readonly endosperm: ReactNode;
    readonly gamete: ReactNode;
    readonly grains: ReactNode;
    readonly progress: string;
    readonly seedCoat: ReactNode;
    readonly stages: Readonly<Record<Stage, string>>;
    readonly view: string;
  };
  readonly mother: number;
  readonly ovules?: number;
  readonly title: NonNullable<ReactNode>;
}) {
  const [elapsed, setElapsed] = useState(1);
  const quantity = useQuantity();
  const counts = seedChromosomes(mother, father);
  const stage = stageAt(elapsed);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.progress}</span>
            <span className="shrink-0">{labels.stages[stage]}</span>
          </div>
          <HandSlider
            label={labels.progress}
            max={1}
            onChange={setElapsed}
            step={1 / 90}
            value={elapsed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={4} setting="studio">
          <Suspense fallback={null}>
            <FertilisationScene
              elapsed={elapsed}
              father={father}
              mother={mother}
              onElapsed={setElapsed}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.embryo}
            value={
              <InlineMath
                math={`${quantity(counts.egg, "", 0)} + ${quantity(counts.sperm, "", 0)} = ${quantity(counts.embryo, "", 0)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.endosperm}
            value={
              <InlineMath
                math={`${quantity(counts.egg, "", 0)} + ${quantity(counts.egg, "", 0)} + ${quantity(counts.sperm, "", 0)} = ${quantity(counts.endosperm, "", 0)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.seedCoat}
            value={<InlineMath math={quantity(counts.seedCoat, "", 0)} />}
          />
          {ovules === undefined ? (
            <VisualFactTabular
              label={labels.gamete}
              value={
                <InlineMath
                  math={`\\dfrac{${quantity(father, "", 0)}}{2} = ${quantity(counts.sperm, "", 0)}`}
                />
              }
            />
          ) : (
            <VisualFactTabular
              label={labels.grains}
              value={
                <InlineMath
                  math={quantity(pollinationNeeds(ovules).grains, "", 0)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
