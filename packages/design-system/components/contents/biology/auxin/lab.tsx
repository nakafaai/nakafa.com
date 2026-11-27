import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";
import { AuxinAgarBendScene } from "@repo/design-system/components/contents/biology/auxin/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AuxinAgarBendLab({
  auxinLevel,
  description,
  labels,
  title,
}: {
  readonly auxinLevel: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly angle?: ReactNode;
    readonly auxinLevel: string;
    readonly elongation?: ReactNode;
    readonly parts: Readonly<
      Record<
        "agarBlock" | "auxinDot" | "coleoptile" | "litSide" | "shadedSide",
        string
      >
    >;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [level, setLevel] = useState(auxinLevel.value);
  const quantity = useQuantity();
  const reading = evaluateAuxinBend(level);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setLevel(auxinLevel.value);
        }}
      />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.auxinLevel}
          label={labels.auxinLevel}
          max={auxinLevel.max}
          min={auxinLevel.min}
          onValueChange={setLevel}
          readout={`${Math.round(level)}`}
          step={Math.max(1, (auxinLevel.max - auxinLevel.min) / 100)}
          value={level}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <AuxinAgarBendScene auxinLevel={level} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.auxinLevel}
            value={`${Math.round(level)}`}
          />
          {labels.angle === undefined ? null : (
            <VisualFactTabular
              label={labels.angle}
              value={
                <InlineMath
                  math={quantity(reading.bendDegrees, "^\\circ", 0)}
                />
              }
            />
          )}
          {labels.elongation === undefined ? null : (
            <VisualFactTabular
              label={labels.elongation}
              value={
                <InlineMath
                  math={quantity(reading.elongationPercent, "\\%", 0)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
