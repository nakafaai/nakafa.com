import { useFrame } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  Battery,
  BEAKER_RADIUS,
  Beaker,
  Bubbles,
  Circuit,
  Deposit,
  Plate,
} from "@repo/design-system/components/contents/chemistry/electrolysis/apparatus";
import type {
  Cell,
  Ion,
  Reaction,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import {
  anodeOf,
  cathodeOf,
  dischargedIon,
  ELECTROLYTE_FORMULA,
  ION_CHARGE,
  ionsOf,
  PRODUCT_FORMULA,
  tintOf,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import {
  BENCH,
  cellCentres,
  ELECTRODE_OFFSET,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import type { ElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import {
  BENCH_LABEL,
  BENCH_LABEL_OUTLINE,
} from "@repo/design-system/components/contents/chemistry/label";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Mote } from "@repo/design-system/components/three/apparatus/mote";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Schema } from "effect";
import { createContext, useRef } from "react";
import type { Group } from "three";

/**
 * What the camera frames, in scene units: the upright face of the row of
 * cells, from what is written under them to the top of the leads over them, wider for every
 * cell in the row. The power pack stands behind that face and inside it as
 * the camera sees it.
 */
function frameOf(count: number) {
  const half = 0.45 + (count - 1) * 0.8;
  return {
    x: { max: half, min: -half },
    y: { max: 2.1, min: -0.7 },
    z: { max: 0.4, min: -0.4 },
  };
}

/** The particles drawn for each kind of ion, and their radius. */
const IONS_PER_KIND = 2;
const ION_RADIUS = 0.05;

/** The words a scene draws beside its apparatus. */
const SceneLabelsSchema = Schema.Struct({
  /** The name of the battery. */
  battery: Schema.String,
});

/** The words a scene draws beside its apparatus. */
export type ElectrolysisSceneLabels = typeof SceneLabelsSchema.Type;

/** What every part of one scene shares: its colors, its words, and whether the products show. */
const ElectrolysisSceneContext = createContext<{
  readonly colors: ElectrolysisColors;
  readonly labels: ElectrolysisSceneLabels;
  readonly showProducts: boolean;
} | null>(null);

/** Reads the surrounding electrolysis scene. */
function useElectrolysisScene() {
  return useRequired(ElectrolysisSceneContext, "useElectrolysisScene");
}

/**
 * Electrolysis cells in series at bench scale: a glass beaker of electrolyte
 * for each cell, two electrode plates, and leads to one battery, with
 * electrons streaming from each anode toward the positive terminal and from
 * the negative terminal into each cathode. When the products show, the ions
 * drift to the electrode of opposite charge, the discharged ones vanish
 * there, a metal coats a cathode, a gas bubbles off, or an anode wears thin.
 */
export function ElectrolysisScene({
  cells,
  colors,
  labels,
  showProducts,
}: {
  readonly cells: Arr.NonEmptyReadonlyArray<Cell>;
  readonly colors: ElectrolysisColors;
  readonly labels: ElectrolysisSceneLabels;
  readonly showProducts: boolean;
}) {
  const centres = cellCentres(cells.length);

  return (
    <ElectrolysisSceneContext value={{ colors, labels, showProducts }}>
      <CameraBounds exclude>
        <LabBench width={3} />
      </CameraBounds>
      <group position={[0, 0, 0.14]} scale={BENCH}>
        <CameraBounds bounds={frameOf(cells.length)}>
          {Arr.map(Arr.zip(cells, centres), ([cell, x], index) => (
            <group
              key={`${cell.electrolyte}-${String(index)}`}
              position={[x, 0, 0]}
            >
              <CellModel cell={cell} />
            </group>
          ))}
          <Battery colors={colors} label={labels.battery} />
          <Circuit colors={colors} count={cells.length} />
        </CameraBounds>
      </group>
    </ElectrolysisSceneContext>
  );
}

/**
 * What is written under a cell, as one block of maths: the sign of each
 * electrode under that electrode, what forms at it under its sign once the
 * products show, and the electrolyte. One block in the clear space before
 * the beaker keeps every word off the apparatus and off its neighbours,
 * however many cells stand in the row and however narrow the frame is.
 */
function captionOf(cell: Cell, showProducts: boolean) {
  const products = showProducts
    ? `\\\\${PRODUCT_FORMULA[anodeOf(cell).product]}&${PRODUCT_FORMULA[cathodeOf(cell).product]}`
    : "";
  return `\\begin{gathered}\\begin{array}{cc}(+)&(-)${products}\\end{array}\\\\${ELECTROLYTE_FORMULA[cell.electrolyte]}\\end{gathered}`;
}

/** One cell: a beaker of electrolyte, its two electrodes, and what happens at them. */
function CellModel({ cell }: { readonly cell: Cell }) {
  const { colors, showProducts } = useElectrolysisScene();
  const anode = anodeOf(cell);
  const cathode = cathodeOf(cell);
  const tinted = tintOf(cell.electrolyte) === "blue";

  return (
    <group>
      <Beaker
        color={tinted ? colors.tintedLiquid : colors.clearLiquid}
        strength={tinted ? 20 : 3}
      />
      <Electrode cell={cell} reaction={anode} x={-ELECTRODE_OFFSET} />
      <Electrode cell={cell} reaction={cathode} x={ELECTRODE_OFFSET} />
      <ThreeLabel
        anchorY="top"
        color={colors.text}
        {...BENCH_LABEL}
        outlineColor={colors.halo}
        outlineWidth={BENCH_LABEL_OUTLINE}
        position={[0, -0.06, BEAKER_RADIUS]}
      >
        <InlineMath math={captionOf(cell, showProducts)} />
      </ThreeLabel>
      {showProducts ? (
        <Ions
          anode={anode}
          cathode={cathode}
          colors={colors}
          ions={ionsOf(cell.electrolyte)}
        />
      ) : null}
    </group>
  );
}

/**
 * One electrode plate. A carbon plate is dull graphite and the others are
 * metal. When the products show, a deposit coats the part in the
 * electrolyte, a dissolving anode wears thin there, and a gas electrode
 * gives off a stream of bubbles.
 */
function Electrode({
  cell,
  reaction,
  x,
}: {
  readonly cell: Cell;
  readonly reaction: Reaction;
  readonly x: number;
}) {
  const { colors, showProducts } = useElectrolysisScene();
  const color = colors.electrode[cell.electrode];
  const wears = showProducts && reaction.change === "dissolves";

  return (
    <group position={[x, 0, 0]}>
      <Plate
        color={color}
        graphite={cell.electrode === "carbon"}
        wear={wears ? 0.55 : 1}
      />
      {showProducts && reaction.change === "deposit" ? (
        <Deposit color={colors.metal[reaction.product]} />
      ) : null}
      {showProducts && reaction.change === "gas" ? (
        <Bubbles color={colors.metal[reaction.product]} />
      ) : null}
    </group>
  );
}

/**
 * The ions of a cell drifting to the electrode of opposite charge. An ion
 * that electrode discharges shrinks to nothing as it arrives; one it leaves alone turns
 * back short of the plate.
 */
function Ions({
  anode,
  cathode,
  colors,
  ions,
}: {
  readonly anode: Reaction;
  readonly cathode: Reaction;
  readonly colors: ElectrolysisColors;
  readonly ions: readonly Ion[];
}) {
  const particles = Arr.flatMap(ions, (ion, kind) =>
    Arr.makeBy(IONS_PER_KIND, (copy) => {
      const isCation = ION_CHARGE[ion] > 0;
      const reaction = isCation ? cathode : anode;
      return {
        discharged: dischargedIon(reaction) === ion,
        id: `${ion}-${String(copy)}`,
        ion,
        phase: (kind * IONS_PER_KIND + copy) / (ions.length * IONS_PER_KIND),
        target: (isCation ? 1 : -1) * (ELECTRODE_OFFSET - 0.06),
        y: 0.18 + ((kind * 2 + copy * 5) % 7) * 0.055,
        z: (((copy * 2 + kind) % 3) - 1) * 0.12,
      };
    })
  );

  return (
    <CameraBounds exclude>
      {Arr.map(particles, (particle) => (
        <IonParticle
          color={colors.ion[particle.ion]}
          discharged={particle.discharged}
          key={particle.id}
          phase={particle.phase}
          target={particle.target}
          y={particle.y}
          z={particle.z}
        />
      ))}
    </CameraBounds>
  );
}

/** One ion moving from the far side of the cell toward its electrode. */
function IonParticle({
  color,
  discharged,
  phase,
  target,
  y,
  z,
}: {
  readonly color: string;
  readonly discharged: boolean;
  readonly phase: number;
  readonly target: number;
  readonly y: number;
  readonly z: number;
}) {
  const mote = useRef<Group>(null);
  const start = -target * 0.9;

  useFrame(({ clock }) => {
    if (mote.current === null) {
      return;
    }
    const progress = (clock.elapsedTime * 0.12 + phase) % 1;
    const travel = discharged
      ? progress
      : 0.75 * (1 - Math.abs(1 - 2 * progress));
    mote.current.position.set(start + (target - start) * travel, y, z);
    mote.current.scale.setScalar(
      discharged ? Math.min(1, (1 - progress) * 6) : 1
    );
  });

  return (
    <Mote
      color={color}
      core={0.55}
      position={[start, y, z]}
      radius={ION_RADIUS}
      ref={mote}
    />
  );
}
