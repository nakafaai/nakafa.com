import { useFrame } from "@react-three/fiber";
import {
  ColumnLiquid,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  Battery,
  BEAKER_RADIUS,
  Beaker,
  Bubbles,
  ELECTRODE_BOTTOM,
  ELECTRODE_THICKNESS,
  ELECTRODE_WIDTH,
  Lead,
  LIQUID_HEIGHT,
} from "@repo/design-system/components/contents/chemistry/electrolysis/apparatus";
import {
  anodeOf,
  type Cell,
  cathodeOf,
  dischargedIon,
  ELECTROLYTE_FORMULA,
  ION_CHARGE,
  type Ion,
  ionsOf,
  PRODUCT_FORMULA,
  type Reaction,
  tintOf,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";
import {
  cellCentres,
  circuitLeads,
  ELECTRODE_OFFSET,
  ELECTRODE_TOP,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import type { ElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import { createContext, useRef } from "react";
import type { Mesh, MeshStandardMaterial } from "three";

/**
 * Metres per scene unit: the cell stands at bench scale, a beaker about
 * 84 mm across with its electrodes 40 mm apart, on the lab bench at y = 0.
 */
const SCENE_SCALE = 0.1;

/** The particles drawn for each kind of ion, and their radius. */
const IONS_PER_KIND = 2;
const ION_RADIUS = 0.034;

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
      <LabBench width={3} />
      <group position={[0, 0, 0.14]} scale={SCENE_SCALE}>
        {Arr.map(Arr.zip(cells, centres), ([cell, x], index) => (
          <group
            key={`${cell.electrolyte}-${String(index)}`}
            position={[x, 0, 0]}
          >
            <CellModel cell={cell} />
          </group>
        ))}
        <Battery colors={colors} label={labels.battery} />
        {Arr.map(circuitLeads(cells.length), (lead, index) => (
          <Lead
            colors={colors}
            key={String(index)}
            lead={lead}
            sheath={index === 0 ? MATERIAL.leadRed : MATERIAL.leadBlack}
          />
        ))}
      </group>
    </ElectrolysisSceneContext>
  );
}

/** One cell: a beaker of electrolyte, its two electrodes, and what happens at them. */
function CellModel({ cell }: { readonly cell: Cell }) {
  const { colors, showProducts } = useElectrolysisScene();
  const anode = anodeOf(cell);
  const cathode = cathodeOf(cell);
  const tinted = tintOf(cell.electrolyte) === "blue";

  return (
    <group>
      <Beaker colors={colors} />
      <ColumnLiquid
        bottom={0.01}
        color={tinted ? colors.tintedLiquid : colors.clearLiquid}
        level={LIQUID_HEIGHT + 0.01}
        opacity={tinted ? 0.5 : 0.28}
        radius={BEAKER_RADIUS - 0.012}
      />
      <Electrode cell={cell} reaction={anode} x={-ELECTRODE_OFFSET} />
      <Electrode cell={cell} reaction={cathode} x={ELECTRODE_OFFSET} />
      <ThreeLabel
        anchorX="right"
        color={colors.text}
        fontSize="compact"
        gap={0.004}
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[-ELECTRODE_OFFSET - 0.06, ELECTRODE_TOP - 0.02, 0.1]}
      >
        <InlineMath math="(+)" />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={colors.text}
        fontSize="compact"
        gap={0.004}
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[ELECTRODE_OFFSET + 0.06, ELECTRODE_TOP - 0.02, 0.1]}
      >
        <InlineMath math="(-)" />
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.006}
        position={[0, -0.06, BEAKER_RADIUS]}
      >
        <InlineMath math={ELECTROLYTE_FORMULA[cell.electrolyte]} />
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
 * gives off a stream of bubbles labelled with the gas.
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
  const height = ELECTRODE_TOP - ELECTRODE_BOTTOM;
  const color = colors.electrode[cell.electrode];
  const wears = showProducts && reaction.change === "dissolves";
  const submerged = LIQUID_HEIGHT - ELECTRODE_BOTTOM;

  return (
    <group position={[x, 0, 0]}>
      <mesh
        castShadow
        position={[0, ELECTRODE_BOTTOM + height / 2, 0]}
        scale={[wears ? 0.55 : 1, 1, 1]}
      >
        <boxGeometry args={[ELECTRODE_THICKNESS, height, ELECTRODE_WIDTH]} />
        {cell.electrode === "carbon" ? (
          <meshStandardMaterial color={color} roughness={0.85} />
        ) : (
          <MetalMaterial color={color} />
        )}
      </mesh>
      {showProducts && reaction.change === "deposit" ? (
        <mesh position={[0, ELECTRODE_BOTTOM + submerged / 2, 0]}>
          <boxGeometry
            args={[
              ELECTRODE_THICKNESS + 0.03,
              submerged,
              ELECTRODE_WIDTH + 0.03,
            ]}
          />
          <MetalMaterial
            color={colors.metal[reaction.product]}
            roughness={0.6}
          />
        </mesh>
      ) : null}
      {showProducts && reaction.change === "gas" ? (
        <Bubbles color={colors.metal[reaction.product]} />
      ) : null}
      {showProducts ? (
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          outlineColor={colors.halo}
          outlineWidth={0.006}
          position={[0, LIQUID_HEIGHT + 0.08, BEAKER_RADIUS * 0.7]}
        >
          <InlineMath math={PRODUCT_FORMULA[reaction.product]} />
        </ThreeLabel>
      ) : null}
    </group>
  );
}

/**
 * The ions of a cell drifting to the electrode of opposite charge. An ion
 * that electrode discharges fades as it arrives; one it leaves alone turns
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
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const start = -target * 0.9;

  useFrame(({ clock }) => {
    if (mesh.current === null || material.current === null) {
      return;
    }
    const progress = (clock.elapsedTime * 0.12 + phase) % 1;
    const travel = discharged
      ? progress
      : 0.75 * (1 - Math.abs(1 - 2 * progress));
    mesh.current.position.set(start + (target - start) * travel, y, z);
    material.current.opacity = discharged ? Math.min(1, (1 - progress) * 6) : 1;
  });

  return (
    <mesh position={[start, y, z]} ref={mesh}>
      <sphereGeometry args={[ION_RADIUS, 16, 12]} />
      <meshStandardMaterial
        color={color}
        ref={material}
        roughness={0.35}
        transparent
      />
    </mesh>
  );
}
