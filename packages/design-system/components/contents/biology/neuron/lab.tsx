import type { Fibre } from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  BARE,
  HURSH,
  speed,
  travel,
} from "@repo/design-system/components/contents/biology/neuron/conduction";
import { NeuronScene } from "@repo/design-system/components/contents/biology/neuron/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** The unit of a speed and of a time, as KaTeX. */
const SPEED = "\\text{ m/s}";
const MILLISECONDS = "\\text{ ms}";

/**
 * A motor neuron sending one impulse down its axon to the skeletal muscle
 * fibres it drives. Along a myelinated fibre the impulse jumps from node to
 * node of Ranvier, at a speed that grows with the fibre's diameter; along a
 * bare fibre it creeps continuously, at a speed that grows only with the
 * square root of the diameter. An electrode on the axon reads the membrane
 * potential as the action potential passes it. The card reads out the
 * fibre's speed and the time the impulse takes over `length` metres.
 */
export function NeuronImpulseLab({
  description,
  fibres,
  labels,
  length,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly fibres: readonly [Fibre, ...Fibre[]];
  readonly labels: {
    readonly fibre: string;
    readonly parts: Readonly<{
      axon: string;
      dendrite: string;
      myelin: string;
      node: string;
      soma: string;
      terminal: string;
    }>;
    readonly potential: ReactNode;
    readonly speed: ReactNode;
    readonly time?: ReactNode;
    readonly view: string;
  };
  readonly length: number;
  readonly title: NonNullable<ReactNode>;
}) {
  const quantity = useQuantity();
  const [chosen, setChosen] = useState(0);
  const fibre = Option.getOrElse(Arr.get(fibres, chosen), () => fibres[0]);
  const [potential, setPotential] = useState<number | null>(null);
  const velocity = speed(fibre);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setChosen(0);
          setPotential(null);
        }}
      />

      {fibres.length > 1 && (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.fibre}
            onValueChange={(value: string) => {
              const index = Number(value);
              if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < fibres.length
              ) {
                setChosen(index);
                setPotential(null);
              }
            }}
            type="single"
            value={String(chosen)}
            variant="outline"
          >
            {Arr.map(fibres, (option, index) => (
              <ToggleGroupItem key={option.name} value={String(index)}>
                {option.name}
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
        <ScienceStage reach={20} setting="studio">
          <Suspense fallback={null}>
            <NeuronScene
              fibre={fibre}
              length={length}
              onPotential={setPotential}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath
                math={
                  fibre.myelinated
                    ? `${HURSH} \\times ${quantity(fibre.diameter, "", 1)} = ${quantity(velocity, SPEED, 1)}`
                    : `${quantity(BARE, "", 2)}\\sqrt{${quantity(fibre.diameter, "", 1)}} = ${quantity(velocity, SPEED, 2)}`
                }
              />
            }
          />
          {labels.time !== undefined && (
            <VisualFactTabular
              label={labels.time}
              value={
                <InlineMath
                  math={`\\dfrac{${quantity(length, "", 2)}}{${quantity(velocity, "", 2)}}\\text{ s} = ${quantity(travel(length, fibre), MILLISECONDS, travel(length, fibre) < 100 ? 1 : 0)}`}
                />
              }
            />
          )}
          <VisualFactTabular
            label={labels.potential}
            value={
              potential === null ? null : (
                <InlineMath math={quantity(potential, "\\text{ mV}", 0)} />
              )
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
