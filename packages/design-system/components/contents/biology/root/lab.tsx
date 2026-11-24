import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { WaterDirection } from "@repo/design-system/components/contents/biology/root/model";
import { evaluateRootUptake } from "@repo/design-system/components/contents/biology/root/model";
import { RootHairScene } from "@repo/design-system/components/contents/biology/root/scene";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Match } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function RootHairUptakeLab({
  description,
  labels,
  soilConcentration,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly directions: Readonly<Record<WaterDirection, string>>;
    readonly ionUptake?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "cortex"
        | "endodermis"
        | "epidermis"
        | "rootHair"
        | "soilWater"
        | "xylem",
        string
      >
    >;
    readonly soilConcentration: string;
    readonly view: string;
    readonly waterDirection?: ReactNode;
  };
  readonly soilConcentration: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [conc, setConc] = useState(soilConcentration.value);
  const reading = evaluateRootUptake(conc);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setConc(soilConcentration.value);
        }}
      />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.soilConcentration}
          label={labels.soilConcentration}
          max={soilConcentration.max}
          min={soilConcentration.min}
          onValueChange={setConc}
          readout={`${Math.round(conc)}`}
          step={Math.max(
            1,
            (soilConcentration.max - soilConcentration.min) / 100
          )}
          value={conc}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <RootHairScene
              direction={reading.direction}
              fluxSpeed={reading.fluxSpeed}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.soilConcentration}
            value={`${Math.round(conc)}`}
          />
          {labels.waterDirection === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={Match.value(reading.direction).pipe(
                Match.when("intoRoot", () => BOTANY_COLORS.waterBlue),
                Match.when("outOfRoot", () => BOTANY_COLORS.xylemCrimson),
                Match.when("balanced", () => BOTANY_COLORS.sucroseGold),
                Match.exhaustive
              )}
              label={labels.waterDirection}
              value={labels.directions[reading.direction]}
            />
          )}
          {labels.ionUptake === undefined ? null : (
            <VisualFactTabular label={labels.ionUptake} value="ATP" />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
