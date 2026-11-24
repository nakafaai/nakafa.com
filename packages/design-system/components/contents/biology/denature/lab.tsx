import type { DenatureEnzyme } from "@repo/design-system/components/contents/biology/denature/model";
import {
  evaluateAmylase,
  evaluatePepsin,
  isDigestedAt,
  MAX_TIME_MINUTES,
  OPTIMUM_PH,
  OPTIMUM_TEMPERATURE,
  pepsinIntactAt,
} from "@repo/design-system/components/contents/biology/denature/model";
import { DenatureScene } from "@repo/design-system/components/contents/biology/denature/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Button } from "@repo/design-system/components/ui/button";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface SliderRange {
  readonly max: number;
  readonly min: number;
  readonly value: number;
}

function clampToRange(value: number, range: SliderRange) {
  return Math.min(range.max, Math.max(range.min, value));
}

function resolveTestResult(
  enzyme: DenatureEnzyme,
  digested: boolean,
  tests: {
    readonly clear?: ReactNode;
    readonly cloudy?: ReactNode;
    readonly noStarch?: ReactNode;
    readonly starch?: ReactNode;
  }
) {
  if (enzyme === "amylase") {
    return digested ? tests.noStarch : tests.starch;
  }
  return digested ? tests.clear : tests.cloudy;
}

export function DenatureLab({
  description,
  enzymes,
  labels,
  ph: phRange,
  temperature: tempRange,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly enzymes: readonly [DenatureEnzyme, ...DenatureEnzyme[]];
  readonly labels: {
    readonly active: ReactNode;
    readonly collisions: ReactNode;
    readonly endpoint: ReactNode;
    readonly enzyme: string;
    readonly enzymes: Readonly<Partial<Record<DenatureEnzyme, string>>>;
    readonly never: ReactNode;
    readonly parts: Readonly<
      Record<"bath" | "tube" | "tile" | "thermometer" | "lens", string>
    >;
    readonly ph?: string;
    readonly rate: ReactNode;
    readonly restore: string;
    readonly temperature?: string;
    readonly test: ReactNode;
    readonly tests: {
      readonly clear?: ReactNode;
      readonly cloudy?: ReactNode;
      readonly noStarch?: ReactNode;
      readonly starch?: ReactNode;
    };
    readonly time: string;
    readonly view: string;
  };
  readonly ph?: SliderRange;
  readonly temperature?: SliderRange;
  readonly title: NonNullable<ReactNode>;
}) {
  const defaultTemp = tempRange?.value ?? OPTIMUM_TEMPERATURE;
  const defaultPh = phRange?.value ?? OPTIMUM_PH;
  const [enzyme, setEnzyme] = useState<DenatureEnzyme>(enzymes[0]);
  const [temp, setTemp] = useState(defaultTemp);
  const [peakTemp, setPeakTemp] = useState(defaultTemp);
  const [ph, setPh] = useState(defaultPh);
  const [minPepsinIntact, setMinPepsinIntact] = useState(() =>
    pepsinIntactAt(defaultPh)
  );
  const [minutes, setMinutes] = useState(4);
  const quantity = useQuantity();

  const metrics =
    enzyme === "amylase"
      ? evaluateAmylase(temp, peakTemp)
      : evaluatePepsin(ph, minPepsinIntact);
  const digested = isDigestedAt(metrics.endpoint, minutes);
  const testResult = resolveTestResult(enzyme, digested, labels.tests);

  const thermometerLevel =
    enzyme === "amylase"
      ? Math.min(1, Math.max(0, temp / 100))
      : Math.min(1, Math.max(0, ph / 14));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setEnzyme(enzymes[0]);
          setTemp(defaultTemp);
          setPeakTemp(defaultTemp);
          setPh(defaultPh);
          setMinPepsinIntact(pepsinIntactAt(defaultPh));
          setMinutes(4);
        }}
      />

      <VisualCardToolbar>
        {enzymes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.enzyme}
            gridColumns={toggleColumns(enzymes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(enzymes, (entry) => entry === next),
                setEnzyme
              );
            }}
            type="single"
            value={enzyme}
            variant="outline"
          >
            {Arr.map(enzymes, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.enzymes[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {enzyme === "amylase" &&
        tempRange !== undefined &&
        labels.temperature !== undefined ? (
          <VisualSlider
            heading={labels.temperature}
            label={labels.temperature}
            max={tempRange.max}
            min={tempRange.min}
            onValueChange={(next) => {
              setTemp(next);
              setPeakTemp((peak) => Math.max(peak, next));
            }}
            readout={
              <InlineMath math={quantity(temp, "^\\circ\\text{C}", 0)} />
            }
            step={1}
            value={temp}
          />
        ) : null}

        {enzyme === "pepsin" &&
        phRange !== undefined &&
        labels.ph !== undefined ? (
          <VisualSlider
            heading={labels.ph}
            label={labels.ph}
            max={phRange.max}
            min={phRange.min}
            onValueChange={(next) => {
              setPh(next);
              setMinPepsinIntact((current) =>
                Math.min(current, pepsinIntactAt(next))
              );
            }}
            readout={<InlineMath math={`\\text{pH } ${quantity(ph, "", 1)}`} />}
            step={0.5}
            value={ph}
          />
        ) : null}

        <VisualSlider
          heading={labels.time}
          label={labels.time}
          max={MAX_TIME_MINUTES}
          min={0}
          onValueChange={setMinutes}
          pauseOnChange
          readout={<InlineMath math={quantity(minutes, "\\text{ min}", 0)} />}
          step={1}
          value={minutes}
        />

        <Button
          onClick={() => {
            if (enzyme === "amylase" && tempRange !== undefined) {
              setTemp(clampToRange(OPTIMUM_TEMPERATURE, tempRange));
            } else if (enzyme === "pepsin" && phRange !== undefined) {
              setPh(clampToRange(OPTIMUM_PH, phRange));
            }
          }}
          variant="outline"
        >
          {labels.restore}
        </Button>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <DenatureScene
              digested={digested}
              enzyme={enzyme}
              intactShare={metrics.intactShare}
              parts={labels.parts}
              thermometerLevel={thermometerLevel}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.test} value={testResult ?? labels.never} />
          <VisualFactTabular
            label={labels.endpoint}
            value={Option.match(metrics.endpoint, {
              onNone: () => labels.never,
              onSome: (done) => (
                <InlineMath math={quantity(done, "\\text{ min}", 1)} />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath
                math={quantity(metrics.relativeRate * 100, "\\%", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={
              metrics.intactShare > 0.5
                ? ENZYME_COLORS.enzymeIntact
                : ENZYME_COLORS.enzymeDenatured
            }
            label={labels.active}
            value={
              <InlineMath
                math={quantity(metrics.intactShare * 100, "\\%", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collisions}
            value={
              <InlineMath
                math={quantity(metrics.collisions, "\\text{ s}^{-1}", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
