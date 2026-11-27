import type {
  Cell,
  Ion,
  Reaction,
  Trend,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import {
  anodeOf,
  cathodeOf,
  gasVolume,
  ION_CHARGE,
  ION_FORMULA,
  ionsOf,
  PRODUCT_FORMULA,
  phTrend,
  productMass,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import { getElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import type { ElectrolysisSceneLabels } from "@repo/design-system/components/contents/chemistry/electrolysis/scene";
import { ElectrolysisScene } from "@repo/design-system/components/contents/chemistry/electrolysis/scene";
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
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useFormatter } from "use-intl";

/** The molar volume of a gas at room conditions, in cubic centimetres, as the SPM paper gives it. */
const ROOM_MOLAR_VOLUME = 24_000;

/** The words an electrolysis lab reads from its document. */
interface ElectrolysisLabels extends ElectrolysisSceneLabels {
  /** The name of the electrode joined to the positive terminal. */
  readonly anode: string;
  /** The fact label for the anode's half-equation and product. */
  readonly atAnode: ReactNode;
  /** The fact label for the cathode's half-equation and product. */
  readonly atCathode: ReactNode;
  /** The name of the electrode joined to the negative terminal. */
  readonly cathode: string;
  /** One caption per cell, naming its electrolyte and electrodes. */
  readonly cells: readonly ReactNode[];
  /** The fact label for the moles of electrons that passed. */
  readonly electrons: ReactNode;
  /** The fact label for how the electrolyte's pH moves. */
  readonly ph: ReactNode;
  /** How the pH moves, in words. */
  readonly trends: Record<Trend, ReactNode>;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Electrolysis of aqueous solutions, one cell or several in series on one
 * battery. The set-up alone suits a question. With `showProducts`, which an
 * explanation sets, the ions drift to the electrodes, the discharged ones
 * leave the solution, and the footer gives each half-equation, the product's
 * mass or volume for the electrons that passed, and how the pH moves.
 *
 * @param cells - The cells in series, the battery's positive terminal joined to the first
 * @param electrons - The moles of electrons that passed, when the amounts should show
 * @param showProducts - Whether the products and reactions show
 */
export function ElectrolysisLab({
  cells,
  description,
  electrons,
  labels,
  showProducts = false,
  title,
}: {
  readonly cells: Arr.NonEmptyReadonlyArray<Cell>;
  readonly description: NonNullable<ReactNode>;
  readonly electrons?: number;
  readonly labels: ElectrolysisLabels;
  readonly showProducts?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const colors = getElectrolysisColors();
  const format = useFormatter();
  const number = (value: number) => mathNumber(format.number(value, "math"));
  const ions = Arr.dedupe(
    Arr.flatMap(cells, (cell) => ionsOf(cell.electrolyte))
  );

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
              cameraPosition={
                cells.length > 1 ? [0.05, 0.27, 0.8] : [0.04, 0.24, 0.66]
              }
              cameraTarget={[0, 0.085, 0.14]}
              fov={34}
              framing="content"
              maxDistance={1.6}
              minDistance={0.2}
            />
            <ElectrolysisScene
              cells={cells}
              colors={colors}
              labels={labels}
              showProducts={showProducts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(cells, (cell, index) => (
            <VisualFact
              key={`${cell.electrolyte}-${String(index)}`}
              label={labels.cells[index]}
              value={
                showProducts ? (
                  <span className="flex flex-col gap-1">
                    <span>
                      <Terminals
                        anode={labels.anode}
                        cathode={labels.cathode}
                      />
                    </span>
                    <span>
                      {labels.atCathode}:{" "}
                      <Reading
                        electrons={electrons}
                        reaction={cathodeOf(cell)}
                      />
                    </span>
                    <span>
                      {labels.atAnode}:{" "}
                      <Reading electrons={electrons} reaction={anodeOf(cell)} />
                    </span>
                    <span>
                      {labels.ph}: {labels.trends[phTrend(cell)]}
                    </span>
                  </span>
                ) : (
                  <Terminals anode={labels.anode} cathode={labels.cathode} />
                )
              }
            />
          ))}
          {showProducts && electrons !== undefined ? (
            <VisualFact
              label={labels.electrons}
              value={<InlineMath math={`${number(electrons)}\\text{ mol}`} />}
            />
          ) : null}
          {showProducts
            ? Arr.map(ions, (ion: Ion) => (
                <VisualFactIndicator
                  indicatorColor={colors.ion[ion]}
                  key={ion}
                  label={<InlineMath math={ION_FORMULA[ion]} />}
                  value={ION_CHARGE[ion] > 0 ? labels.cathode : labels.anode}
                />
              ))
            : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** One electrode's half-equation, then its product's amount when the electrons are known. */
function Reading({
  electrons,
  reaction,
}: {
  readonly electrons: number | undefined;
  readonly reaction: Reaction;
}) {
  const format = useFormatter();
  const number = (value: number) => mathNumber(format.number(value, "math"));
  if (electrons === undefined) {
    return <InlineMath math={reaction.equation} />;
  }
  const amount =
    reaction.change === "gas"
      ? `V(${PRODUCT_FORMULA[reaction.product]})=${number(gasVolume(reaction, electrons, ROOM_MOLAR_VOLUME))}\\text{ cm}^3`
      : `\\Delta m=${reaction.change === "dissolves" ? "-" : "+"}${number(productMass(reaction, electrons))}\\text{ g}`;
  return (
    <>
      <InlineMath math={reaction.equation} />, <InlineMath math={amount} />
    </>
  );
}

/** Which electrode is which: the anode joined to the positive terminal, the cathode to the negative. */
function Terminals({
  anode,
  cathode,
}: {
  readonly anode: string;
  readonly cathode: string;
}) {
  return (
    <>
      {anode} <InlineMath math="(+)" />, {cathode} <InlineMath math="(-)" />
    </>
  );
}
