import { useFrame } from "@react-three/fiber";
import type {
  CombiningVolumesElement,
  CombiningVolumesGasModel,
  CombiningVolumesModeId,
  CombiningVolumesMoleculeKind,
  CombiningVolumesSceneColors,
  CombiningVolumesSceneLabelsSchema,
  CombiningVolumesScenePoint,
} from "@repo/design-system/components/contents/chemistry/combining-volumes-law/data";
import {
  COMBINING_VOLUMES_MODELS,
  CombiningVolumesElementSchema,
  CombiningVolumesScenePointSchema,
} from "@repo/design-system/components/contents/chemistry/combining-volumes-law/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/label";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { Array as Arr, HashMap, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { createContext, useMemo, useRef } from "react";
import type { Group } from "three";
import { Quaternion, Vector2, Vector3 } from "three";

const REACTANTS_X = -1.08;
const PRODUCTS_X = 1.08;
const SCENE_SCALE = 1.62;
const TUBE_RADIUS = 0.22;
const VOLUME_UNIT_HEIGHT = 0.42;
const TUBE_BASE_Y = -0.56;
const COLUMN_GAP = 0.62;
const BOND_STICK_RADIUS = 0.015;
const UP_AXIS = new Vector3(0, 1, 0);

const MoleculeAtomSchema = Schema.Struct({
  element: CombiningVolumesElementSchema,
  id: Schema.String,
  position: CombiningVolumesScenePointSchema,
});
type MoleculeAtom = typeof MoleculeAtomSchema.Type;

const AtomStyleSchema = Schema.Struct({
  color: CombiningVolumesElementSchema,
  radius: Schema.Finite,
  symbol: Schema.String,
});

const ATOM_STYLE = {
  hydrogen: { color: "hydrogen", radius: 0.045, symbol: "H" },
  nitrogen: { color: "nitrogen", radius: 0.064, symbol: "N" },
  oxygen: { color: "oxygen", radius: 0.064, symbol: "O" },
} satisfies Record<CombiningVolumesElement, typeof AtomStyleSchema.Type>;

const MoleculeSpecSchema = Schema.Struct({
  atoms: Schema.Array(MoleculeAtomSchema),
  bonds: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
});

const MOLECULE_SPECS = {
  ammonia: molecule([
    atom("n", "nitrogen", [0, 0.02, 0]),
    atom("h-left", "hydrogen", [-0.12, -0.08, 0.04]),
    atom("h-right", "hydrogen", [0.12, -0.08, -0.04]),
    atom("h-top", "hydrogen", [0, 0.17, -0.03]),
  ]),
  hydrogen: molecule([
    atom("h-left", "hydrogen", [-0.08, 0, 0.02]),
    atom("h-right", "hydrogen", [0.08, 0, -0.02]),
  ]),
  nitrogen: molecule([
    atom("n-left", "nitrogen", [-0.08, 0, 0.02]),
    atom("n-right", "nitrogen", [0.08, 0, -0.02]),
  ]),
  oxygen: molecule([
    atom("o-left", "oxygen", [-0.08, 0, 0.02]),
    atom("o-right", "oxygen", [0.08, 0, -0.02]),
  ]),
  "water-vapor": molecule([
    atom("o", "oxygen", [0, 0.02, 0]),
    atom("h-left", "hydrogen", [-0.12, -0.08, 0.04]),
    atom("h-right", "hydrogen", [0.12, -0.08, -0.04]),
  ]),
} satisfies Record<
  CombiningVolumesMoleculeKind,
  typeof MoleculeSpecSchema.Type
>;

const CombiningVolumesSceneContext = createContext<{
  colors: CombiningVolumesSceneColors;
  volumeUnit: string;
} | null>(null);

/** Reads the colors and the volume unit of the surrounding combining-volumes scene. */
function useCombiningVolumesScene() {
  return useRequired(CombiningVolumesSceneContext, "useCombiningVolumesScene");
}

export function CombiningVolumesScene({
  colors,
  labels,
  modeId,
}: {
  colors: CombiningVolumesSceneColors;
  labels: typeof CombiningVolumesSceneLabelsSchema.Type;
  modeId: CombiningVolumesModeId;
}) {
  const model = COMBINING_VOLUMES_MODELS[modeId];

  return (
    <CombiningVolumesSceneContext
      value={{ colors, volumeUnit: labels.volumeUnit }}
    >
      <group position={[0, 0.08, 0]} scale={SCENE_SCALE}>
        <ThreeLabel
          anchorY="bottom"
          color={colors.text}
          fontSize="compact"
          position={[REACTANTS_X, 0.88, 0]}
        >
          {labels.reactants}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={colors.text}
          fontSize="compact"
          position={[PRODUCTS_X, 0.88, 0]}
        >
          {labels.products}
        </ThreeLabel>
        <GasSet gases={model.reactants} x={REACTANTS_X} />
        <ArrowHelper
          arrowSize={0.18}
          color={getColor("WHITE")}
          from={[-0.24, -0.06, 0]}
          lineWidth={3}
          to={[0.24, -0.06, 0]}
        />
        <GasSet gases={model.products} x={PRODUCTS_X} />
      </group>
    </CombiningVolumesSceneContext>
  );
}

function GasSet({
  gases,
  x,
}: {
  gases: readonly CombiningVolumesGasModel[];
  x: number;
}) {
  const centerOffset = ((gases.length - 1) * COLUMN_GAP) / 2;

  return (
    <group position={[x, 0, 0]}>
      {Arr.map(gases, (gas, index) => (
        <GasColumn
          gas={gas}
          key={gas.id}
          x={index * COLUMN_GAP - centerOffset}
        />
      ))}
    </group>
  );
}

function GasColumn({ gas, x }: { gas: CombiningVolumesGasModel; x: number }) {
  const { colors, volumeUnit } = useCombiningVolumesScene();
  const height = gas.volumeUnits * VOLUME_UNIT_HEIGHT;
  const columnCenterY = TUBE_BASE_Y + height / 2;
  const volumeUnits = Arr.map(
    Arr.range(0, gas.volumeUnits - 1),
    (zeroBased) => ({
      id: `${gas.id}-volume-${zeroBased + 1}`,
      phase: zeroBased * 0.7,
      y: TUBE_BASE_Y + (zeroBased + 0.5) * VOLUME_UNIT_HEIGHT,
    })
  );

  return (
    <group position={[x, 0, 0]}>
      <group position={[0, columnCenterY, 0]}>
        <VolumeTube
          colors={colors}
          height={height}
          volumeUnits={gas.volumeUnits}
        />
      </group>

      {Arr.map(volumeUnits, (unit) => (
        <group key={unit.id} position={[0, unit.y, 0]}>
          <VolumeBand color={colors[gas.fillColor]} />
          <FloatingMolecule phase={unit.phase}>
            <Molecule kind={gas.moleculeKind} />
          </FloatingMolecule>
        </group>
      ))}

      <ThreeLabel
        anchorY="top"
        color={colors.text}
        fontSize="compact"
        position={[0, TUBE_BASE_Y - 0.14, 0.24]}
      >
        <span className="block">
          <InlineMath math={gas.formulaLabel} />
        </span>
        <span className="block">
          <InlineMath math={`${gas.volumeUnits}`} /> {volumeUnit}
        </span>
      </ThreeLabel>
    </group>
  );
}

/** How thick a gas jar's wall and its base are drawn, and how far its ground flange stands out. */
const JAR = { base: 0.03, flange: 0.045, wall: 0.016 } as const;

/**
 * A gas jar's wall in section for a jar `height` tall, its middle at y = 0:
 * a thick base, a straight wall, a ground flange round the mouth for the
 * cover plate to seal on, and the inner wall back down.
 */
function jarProfile(height: number) {
  const top = height / 2;
  const bottom = -height / 2;
  return Arr.map(
    [
      [0.001, bottom],
      [TUBE_RADIUS - 0.03, bottom],
      [TUBE_RADIUS - 0.008, bottom + 0.008],
      [TUBE_RADIUS, bottom + 0.03],
      [TUBE_RADIUS, top - 0.03],
      [TUBE_RADIUS + JAR.flange, top - 0.016],
      [TUBE_RADIUS + JAR.flange, top],
      [TUBE_RADIUS - JAR.wall, top],
      [TUBE_RADIUS - JAR.wall, bottom + JAR.base + 0.02],
      [TUBE_RADIUS - JAR.wall - 0.02, bottom + JAR.base],
      [0.001, bottom + JAR.base],
    ] as const,
    ([radius, y]) => new Vector2(radius, y)
  );
}

/**
 * A borosilicate gas jar `height` tall, closed with a ground-glass cover
 * plate, with a white enamel ring printed at every volume mark.
 */
function VolumeTube({
  colors,
  height,
  volumeUnits,
}: {
  colors: CombiningVolumesSceneColors;
  height: number;
  volumeUnits: number;
}) {
  const profile = useMemo(() => jarProfile(height), [height]);
  const marks = Arr.map(
    Arr.range(1, volumeUnits),
    (unit) => -height / 2 + unit * VOLUME_UNIT_HEIGHT - 0.012
  );

  return (
    <group>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[profile, 96]} />
        <GlassMaterial color={colors.glass} opacity={0.22} />
      </mesh>

      <mesh castShadow position={[0, height / 2 + 0.011, 0]} renderOrder={3}>
        <cylinderGeometry
          args={[
            TUBE_RADIUS + JAR.flange + 0.012,
            TUBE_RADIUS + JAR.flange + 0.012,
            0.018,
            64,
          ]}
        />
        <meshPhysicalMaterial
          clearcoat={0.3}
          clearcoatRoughness={0.5}
          color={colors.glass}
          opacity={0.62}
          roughness={0.55}
          transparent
        />
      </mesh>

      {Arr.map(marks, (y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0.9]}>
          <torusGeometry
            args={[TUBE_RADIUS + 0.002, 0.0035, 8, 48, Math.PI * 0.7]}
          />
          <meshBasicMaterial
            color={BENCH_COLORS.ptfe}
            depthWrite={false}
            opacity={0.9}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function VolumeBand({ color }: { color: string }) {
  return (
    <mesh>
      <cylinderGeometry
        args={[
          TUBE_RADIUS * 0.84,
          TUBE_RADIUS * 0.84,
          VOLUME_UNIT_HEIGHT * 0.78,
          42,
        ]}
      />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        opacity={0.22}
        roughness={0.3}
        transparent
      />
    </mesh>
  );
}

function FloatingMolecule({
  children,
  phase,
}: {
  children: ReactNode;
  phase: number;
}) {
  const groupRef = useRef<Group>(null);
  const { advance } = useSimulationClock(0);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y = phase + advance(delta) * 0.32;
  });

  return (
    <group scale={0.78}>
      <CameraBounds motion={{ rotation: "y" }} objectRef={groupRef}>
        {children}
      </CameraBounds>
    </group>
  );
}

function BondStick({
  color,
  end,
  start,
}: {
  color: string;
  end: CombiningVolumesScenePoint;
  start: CombiningVolumesScenePoint;
}) {
  const transform = useMemo(() => {
    const from = new Vector3(...start);
    const to = new Vector3(...end);
    const delta = new Vector3().subVectors(to, from);
    const span = delta.length();
    const midpoint = new Vector3().addVectors(from, to).multiplyScalar(0.5);
    const quaternion = new Quaternion().setFromUnitVectors(
      UP_AXIS,
      delta.normalize()
    );
    return { midpoint, quaternion, span };
  }, [end, start]);

  return (
    <mesh
      castShadow
      position={transform.midpoint}
      quaternion={transform.quaternion}
      receiveShadow
    >
      <cylinderGeometry
        args={[BOND_STICK_RADIUS, BOND_STICK_RADIUS, transform.span, 18]}
      />
      <meshPhysicalMaterial clearcoat={0.55} color={color} roughness={0.26} />
    </mesh>
  );
}

function Molecule({ kind }: { kind: CombiningVolumesMoleculeKind }) {
  const { colors } = useCombiningVolumesScene();
  const { atoms, bonds } = MOLECULE_SPECS[kind];
  const atomsById = HashMap.fromIterable(
    Arr.map(atoms, (atomData) => [atomData.id, atomData])
  );

  return (
    <group>
      {Arr.map(bonds, ([startId, endId]) => {
        const start = HashMap.get(atomsById, startId);
        const end = HashMap.get(atomsById, endId);

        if (Option.isNone(start) || Option.isNone(end)) {
          return null;
        }

        return (
          <BondStick
            color={colors.bond}
            end={end.value.position}
            key={`${startId}-${endId}`}
            start={start.value.position}
          />
        );
      })}

      {Arr.map(atoms, (atomData) => (
        <AtomParticle atomData={atomData} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({ atomData }: { atomData: MoleculeAtom }) {
  const { colors } = useCombiningVolumesScene();
  const style = ATOM_STYLE[atomData.element];

  return (
    <group position={atomData.position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[style.radius, 36, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.65}
          clearcoatRoughness={0.1}
          color={colors[style.color]}
          roughness={0.24}
        />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getThreeParticleLabelFontSize(style.radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(style.radius)}
      >
        <InlineMath math={style.symbol} />
      </ChemistryParticleLabel>
    </group>
  );
}

function atom(
  id: string,
  element: CombiningVolumesElement,
  position: CombiningVolumesScenePoint
): MoleculeAtom {
  return { element, id, position };
}

function molecule(atoms: readonly MoleculeAtom[]) {
  return {
    atoms,
    bonds: Arr.map(
      Arr.drop(atoms, 1),
      (atomData) => [atoms[0].id, atomData.id] as const
    ),
  };
}
