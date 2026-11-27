import type { Metal } from "@repo/design-system/components/contents/chemistry/voltaic/cell";
import {
  cellOf,
  halfCell,
  massFor,
  oxidation,
  reduction,
} from "@repo/design-system/components/contents/chemistry/voltaic/cell";
import {
  ChemicalCellScene,
  HalfCell,
} from "@repo/design-system/components/contents/chemistry/voltaic/scene";
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
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useFormatter } from "use-intl";

/** Numbers in a reading keep three significant figures, as SPM working does. */
const READING = { maximumSignificantDigits: 3, useGrouping: false } as const;

/** Potentials keep two decimal places, as the SPM data page prints them. */
const POTENTIAL = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  useGrouping: false,
} as const;

/** The words a chemical cell lab reads from its document. */
interface ChemicalCellLabels {
  /** The fact label for the half-equation and mass change at the negative terminal. */
  readonly atNegative: ReactNode;
  /** The fact label for the half-equation and mass change at the positive terminal. */
  readonly atPositive: ReactNode;
  /** The fact label for the moles of electrons that passed. */
  readonly electrons: ReactNode;
  /** The fact label naming the two half-cells. */
  readonly halfCells: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
  /** The fact label for the cell's voltage. */
  readonly voltage: ReactNode;
  /** The word on the voltmeter's face before it reads. */
  readonly voltmeter: string;
}

/**
 * A chemical cell of two metals in solutions of their own ions, joined by a
 * salt bridge, the metal with the more negative standard electrode potential
 * on the left as the negative terminal. The set-up alone suits a question.
 * With `showProducts`, which an explanation sets, the voltmeter reads the
 * cell voltage, the negative plate wears thin and the positive plate takes a
 * coat, and the footer gives each half-equation with the mass that dissolves
 * or deposits for `electrons` moles of electrons.
 *
 * @param metals - The two metals, in either order
 * @param electrons - The moles of electrons that passed, when the masses should show
 * @param showProducts - Whether the reading and the products show
 */
export function ChemicalCellLab({
  description,
  electrons,
  labels,
  metals,
  showProducts = false,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly electrons?: number;
  readonly labels: ChemicalCellLabels;
  readonly metals: readonly [Metal, Metal];
  readonly showProducts?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const number = (value: number) => mathNumber(format.number(value, READING));
  const volts = (value: number) => mathNumber(format.number(value, POTENTIAL));
  const cell = cellOf(metals[0], metals[1]);
  const reading = `${volts(cell.voltage)}\\text{ V}`;
  const negative = halfCell(cell.negative);
  const positive = halfCell(cell.positive);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.05, 0.25, 0.78]}
              cameraTarget={[0, 0.085, 0.14]}
              fov={34}
              framing="content"
              maxDistance={1.6}
              minDistance={0.2}
            />
            <ChemicalCellScene
              reading={reading}
              showProducts={showProducts}
              voltage={cell.voltage}
              voltmeter={labels.voltmeter}
            >
              <HalfCell
                metal={cell.negative}
                showProducts={showProducts}
                side={-1}
              />
              <HalfCell
                metal={cell.positive}
                showProducts={showProducts}
                side={1}
              />
            </ChemicalCellScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.halfCells}
            value={
              <InlineMath
                math={`${negative.symbol}\\,|\\,${negative.ion}\\ \\|\\ ${positive.ion}\\,|\\,${positive.symbol}`}
              />
            }
          />
          {showProducts ? (
            <>
              <VisualFact
                label={labels.voltage}
                value={
                  <InlineMath
                    math={`${volts(positive.potential)}-(${volts(negative.potential)})=${reading}`}
                  />
                }
              />
              <VisualFact
                label={labels.atNegative}
                value={
                  <Change
                    electrons={electrons}
                    equation={oxidation(cell.negative)}
                    sign="-"
                    weight={
                      electrons === undefined
                        ? undefined
                        : number(massFor(cell.negative, electrons))
                    }
                  />
                }
              />
              <VisualFact
                label={labels.atPositive}
                value={
                  <Change
                    electrons={electrons}
                    equation={reduction(cell.positive)}
                    sign="+"
                    weight={
                      electrons === undefined
                        ? undefined
                        : number(massFor(cell.positive, electrons))
                    }
                  />
                }
              />
              {electrons === undefined ? null : (
                <VisualFact
                  label={labels.electrons}
                  value={
                    <InlineMath math={`${number(electrons)}\\text{ mol}`} />
                  }
                />
              )}
            </>
          ) : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** One terminal's half-equation, then the mass its plate gains or loses. */
function Change({
  electrons,
  equation,
  sign,
  weight,
}: {
  readonly electrons: number | undefined;
  readonly equation: string;
  readonly sign: "+" | "-";
  readonly weight: string | undefined;
}) {
  if (electrons === undefined || weight === undefined) {
    return <InlineMath math={equation} />;
  }
  return (
    <>
      <InlineMath math={equation} />,{" "}
      <InlineMath math={`\\Delta m=${sign}${weight}\\text{ g}`} />
    </>
  );
}
