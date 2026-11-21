import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { SynapseScene } from "@repo/design-system/components/contents/biology/synapse/scene";
import type {
  Drug,
  Treatment,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import {
  potentialAt,
  synapseTime,
  transmitterAt,
  treatmentOf,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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

/** The rate the impulses arrive at when the lab opens, a second. */
const OPENING_RATE = 10;

/** The slowest and fastest rates the reader can set, a second. */
const RATES = { fastest: 50, slowest: 1 };

/**
 * Where the run opens, in seconds on the screen: the first impulse's
 * acetylcholine has crossed the cleft, sits on the receptors and is being
 * split, so the still frame shows every step at once.
 */
const OPENING = 2.35;

/**
 * A cholinergic synapse between two neurons, cut open at the scale of an
 * electron micrograph. Impulses arrive at the rate the reader sets: each
 * lets Ca2+ into the bouton, two vesicles release acetylcholine, it crosses
 * the cleft and opens the receptors, Na+ flows in and depolarises the
 * dendrite, and acetylcholinesterase splits it while choline is taken back.
 * Fast enough, the potentials sum to threshold and the next neuron fires. A
 * drug changes the one step it acts on.
 */
export function SynapseLab({
  description,
  drugs,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly drugs?: readonly [Drug, ...Drug[]];
  readonly labels: {
    readonly drug: string;
    readonly drugs?: Readonly<Record<Drug, string>>;
    readonly fires: ReactNode;
    readonly none: string;
    readonly parts: {
      readonly channel: ReactNode;
      readonly cleft: ReactNode;
      readonly enzyme: ReactNode;
      readonly mitochondrion: ReactNode;
      readonly receptor: ReactNode;
      readonly transporter: ReactNode;
      readonly vesicle: ReactNode;
    };
    readonly potential: ReactNode;
    readonly rate: string;
    readonly rests: ReactNode;
    readonly response: ReactNode;
    readonly transmitter: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [rate, setRate] = useState(OPENING_RATE);
  const [treatment, setTreatment] = useState<Treatment>("none");
  const [elapsed, setElapsed] = useState(OPENING);
  const quantity = useQuantity();
  const time = synapseTime(elapsed, rate);
  const transmitter = transmitterAt(time, rate, treatment);
  const { fired, potential } = potentialAt(time, rate, treatment);
  const names = labels.drugs;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setRate(OPENING_RATE);
          setTreatment("none");
          setElapsed(OPENING);
        }}
      />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.rate}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(rate, "\\text{ s}^{-1}", 0)} />
            </span>
          </div>
          <Slider
            aria-label={labels.rate}
            max={RATES.fastest}
            min={RATES.slowest}
            onValueChange={(value: number) => {
              setRate(value);
              setElapsed(OPENING);
            }}
            step={1}
            value={rate}
          />
        </div>
        {drugs !== undefined && names !== undefined && (
          <ToggleGroup
            aria-label={labels.drug}
            gridColumns="auto"
            onValueChange={(value: string) => {
              if (value === "") {
                return;
              }
              setTreatment(treatmentOf(value));
              setElapsed(OPENING);
            }}
            type="single"
            value={treatment}
            variant="outline"
          >
            <ToggleGroupItem value="none">{labels.none}</ToggleGroupItem>
            {Arr.map(drugs, (drug) => (
              <ToggleGroupItem key={drug} value={drug}>
                {names[drug]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={40} setting="studio">
          <Suspense fallback={null}>
            <SynapseScene
              elapsed={elapsed}
              onElapsed={setElapsed}
              parts={labels.parts}
              rate={rate}
              treatment={treatment}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.transmitter}
            value={
              <InlineMath
                math={quantity(Math.round(transmitter / 100) * 100, "", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.potential}
            value={<InlineMath math={quantity(potential, "\\text{ mV}", 1)} />}
          />
          <VisualFactTabular
            label={labels.response}
            value={fired ? labels.fires : labels.rests}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
