import { MathLines } from "@repo/design-system/components/contents/chemistry/lines";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import type {
  Analyte,
  Hue,
  Indicator,
  Titrant,
  Titration,
} from "@repo/design-system/components/contents/chemistry/titration/model";
import {
  analyteMoles,
  endPoint,
  hueAfter,
  pairOf,
  phAfter,
  SOLUTE_FORMULA,
} from "@repo/design-system/components/contents/chemistry/titration/model";
import {
  BURETTE_CAPACITY,
  TitrationScene,
} from "@repo/design-system/components/contents/chemistry/titration/scene";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useFormatter } from "use-intl";

/** Numbers in a reading keep three significant figures, as SPM working does. */
const READING = { maximumSignificantDigits: 3, useGrouping: false } as const;

/** The words a titration lab reads from its document. */
interface TitrationLabels {
  /** The slider and fact label for the volume run out of the burette. */
  readonly added: string;
  /** The fact label naming the flask's solution. */
  readonly analyte: ReactNode;
  /** The fact label for the end point's working. */
  readonly endPoint: ReactNode;
  /** The fact label for the flask's colour. */
  readonly hue: ReactNode;
  /** Each colour the flask can show, in words. */
  readonly hues: Record<Hue, ReactNode>;
  /** The fact label for the pH of the flask. */
  readonly ph: ReactNode;
  /** The fact label for the equation. */
  readonly reaction: ReactNode;
  /** The fact label naming the burette's solution. */
  readonly titrant: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A titration at bench scale, the set-up alone for a question. With
 * `showEndPoint`, which an explanation sets, a slider runs titrant out of the
 * burette: the flask fills and changes colour at the end point, and the
 * footer reads the volume, the colour, the pH of a strong acid and base, the
 * equation, and the working that finds the end point.
 *
 * @param titrant - The burette's solute and its concentration in mol dm⁻³
 * @param analyte - The flask's solute, its concentration, and its volume in cm³
 * @param indicator - The indicator in the flask, or none for dichromate
 * @param showEndPoint - Whether the slider and the end point show
 */
export function TitrationLab({
  analyte,
  description,
  indicator,
  labels,
  showEndPoint = false,
  title,
  titrant,
}: {
  readonly analyte: {
    readonly concentration: number;
    readonly solute: Analyte;
    readonly volume: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly indicator: Indicator;
  readonly labels: TitrationLabels;
  readonly showEndPoint?: boolean;
  readonly title: NonNullable<ReactNode>;
  readonly titrant: {
    readonly concentration: number;
    readonly solute: Titrant;
  };
}) {
  const titration: Titration = { analyte, indicator, titrant };
  const pair = pairOf(titration);
  const end = pair === undefined ? 0 : endPoint(titration, pair);
  const most = Math.min(BURETTE_CAPACITY, Math.max(end * 1.5, 1));
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const added = showEndPoint ? Math.min(chosen ?? end, most) : 0;
  const format = useFormatter();
  const number = (value: number) => mathNumber(format.number(value, READING));
  const ph = phAfter(titration, added);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {showEndPoint ? (
        <VisualCardToolbar>
          <div className="flex w-full flex-col gap-3">
            <span className="text-sm">{labels.added}</span>
            <HandSlider
              label={labels.added}
              max={most}
              onChange={setChosen}
              step={0.1}
              value={added}
            />
          </div>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.9} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.1, 0.44, 1.32]}
              cameraTarget={[-0.01, 0.37, 0.05]}
              fov={38}
              maxDistance={2.4}
              minDistance={0.3}
            />
            <TitrationScene
              added={added}
              showReading={showEndPoint}
              titration={titration}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.titrant}
            value={
              <InlineMath
                math={`${number(titrant.concentration)}\\text{ mol dm}^{-3}\\ ${SOLUTE_FORMULA[titrant.solute]}`}
              />
            }
          />
          <VisualFact
            label={labels.analyte}
            value={
              <InlineMath
                math={`${number(analyte.volume)}\\text{ cm}^3,\\ ${number(analyte.concentration)}\\text{ mol dm}^{-3}\\ ${SOLUTE_FORMULA[analyte.solute]}`}
              />
            }
          />
          {showEndPoint ? (
            <>
              <VisualFact
                label={labels.added}
                value={<InlineMath math={`${number(added)}\\text{ cm}^3`} />}
              />
              <VisualFact
                label={labels.hue}
                value={labels.hues[hueAfter(titration, added)]}
              />
              {ph === undefined ? null : (
                <VisualFact
                  label={labels.ph}
                  value={<InlineMath math={number(ph)} />}
                />
              )}
              {pair === undefined ? null : (
                <>
                  <VisualFact
                    label={labels.reaction}
                    value={<InlineMath math={pair.equation} />}
                  />
                  <VisualFact
                    label={labels.endPoint}
                    value={
                      <MathLines
                        lines={[
                          `n(${SOLUTE_FORMULA[analyte.solute]})=${number(analyte.concentration)}\\times\\frac{${number(analyte.volume)}}{1000}=${number(analyteMoles(titration))}\\text{ mol}`,
                          `V=\\frac{${number(analyteMoles(titration) / pair.ratio)}}{${number(titrant.concentration)}}\\times1000=${number(end)}\\text{ cm}^3`,
                        ]}
                      />
                    }
                  />
                </>
              )}
            </>
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
