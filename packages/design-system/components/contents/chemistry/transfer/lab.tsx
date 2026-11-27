import { MathLines } from "@repo/design-system/components/contents/chemistry/lines";
import type { PairId } from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  getPair,
  ionTex,
  PairIdSchema,
  shellsAfterGain,
  shellsAfterLoss,
  shellsTex,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import {
  TransferCamera,
  TransferScene,
} from "@repo/design-system/components/contents/chemistry/transfer/scene";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useFormatter } from "use-intl";

/** The words an ion formation lab reads from its lesson. */
interface TransferLabels {
  /** The name of the toggle that chooses a pair, for assistive technology. */
  readonly choose: string;
  /** The readout of the metal's radius before and after. */
  readonly metalRadius: ReactNode;
  /** The readout of the metal's shells before and after. */
  readonly metalShells: ReactNode;
  /** The readout of the nonmetal's radius before and after. */
  readonly nonmetalRadius: ReactNode;
  /** The readout of the nonmetal's shells before and after. */
  readonly nonmetalShells: ReactNode;
  /** The name of the slider that moves the electrons. */
  readonly progress: string;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Two atoms become two ions: the metal's outer electrons cross to the
 * nonmetal's outer shell. As they cross, each atom's shells ease from its
 * atomic radius to its ionic radius, at real scale: the metal draws in and
 * loses its emptied outer shell, the nonmetal swells round its filled one,
 * and each shows its new charge.
 *
 * @param pairs - The metal and nonmetal pairs to offer, in order
 */
export function IonFormationLab({
  description,
  labels,
  pairs,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: TransferLabels;
  readonly pairs: readonly PairId[];
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const offered = Arr.filter(pairs, (id) => Schema.is(PairIdSchema)(id));
  const [chosen, setChosen] = useState<PairId | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const quantity = useQuantity();
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const pair = getPair(shown);
  const number = (value: number) => mathNumber(format.number(value, "math"));
  const metalAfter = shellsAfterLoss(pair.metal.shells, pair.electrons);
  const nonmetalAfter = shellsAfterGain(pair.nonmetal.shells, pair.electrons);

  return (
    <VisualCard
      onReset={() => {
        setChosen(undefined);
        setProgress(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {offered.length > 1 ? (
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={toggleColumns(offered.length)}
            onValueChange={(value: string) => {
              if (Schema.is(PairIdSchema)(value)) {
                setChosen(value);
                setProgress(0);
              }
            }}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={`${getPair(id).metal.symbol} ${getPair(id).nonmetal.symbol}`}
                key={id}
                value={id}
              >
                <InlineMath
                  math={`\\mathrm{${getPair(id).metal.symbol}} + \\mathrm{${getPair(id).nonmetal.symbol}}`}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <VisualSlider
          heading={labels.progress}
          label={labels.progress}
          max={1}
          min={0}
          onValueChange={setProgress}
          pauseOnChange
          readout={<InlineMath math={quantity(progress * 100, "\\%", 0)} />}
          step={0.01}
          value={progress}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={5} setting="space">
          <TransferCamera />
          <TransferScene
            onProgress={setProgress}
            pairId={shown}
            progress={progress}
          />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.metalShells}
            value={
              <MathLines
                lines={[
                  `\\mathrm{${pair.metal.symbol}}\\ ${shellsTex(pair.metal.shells)}`,
                  `\\rightarrow ${ionTex(pair.metal.symbol, pair.electrons)}\\ ${shellsTex(metalAfter)}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalShells}
            value={
              <MathLines
                lines={[
                  `\\mathrm{${pair.nonmetal.symbol}}\\ ${shellsTex(pair.nonmetal.shells)}`,
                  `\\rightarrow ${ionTex(pair.nonmetal.symbol, -pair.electrons)}\\ ${shellsTex(nonmetalAfter)}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.metalRadius}
            value={
              <MathLines
                lines={[
                  `${number(pair.metal.atomic)}\\ \\mathrm{pm}`,
                  `\\rightarrow ${number(pair.metal.ionic)}\\ \\mathrm{pm}`,
                ]}
              />
            }
          />
          <VisualFact
            label={labels.nonmetalRadius}
            value={
              <MathLines
                lines={[
                  `${number(pair.nonmetal.atomic)}\\ \\mathrm{pm}`,
                  `\\rightarrow ${number(pair.nonmetal.ionic)}\\ \\mathrm{pm}`,
                ]}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
