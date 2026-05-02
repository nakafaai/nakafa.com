import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  COMBINING_VOLUMES_MODELS,
  type CombiningVolumesElement,
  type CombiningVolumesGasModel,
  type CombiningVolumesLabLabels,
  type CombiningVolumesModeId,
  type CombiningVolumesMoleculeKind,
  type CombiningVolumesSceneColors,
  type CombiningVolumesScenePoint,
} from "@repo/design-system/components/contents/chemistry/combining-volumes-law/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import { useRef } from "react";
import { DoubleSide, type Group } from "three";

const REACTANTS_X = -1.05;
const PRODUCTS_X = 1.05;
const SCENE_SCALE = 1.68;
const TUBE_RADIUS = 0.22;
const VOLUME_UNIT_HEIGHT = 0.42;
const COLUMN_GAP = 0.62;
const BOND_LINE_WIDTH = 2.1;

interface MoleculeAtom {
  element: CombiningVolumesElement;
  id: string;
  position: CombiningVolumesScenePoint;
}

const ATOM_STYLE = {
  hydrogen: { color: "hydrogen", radius: 0.045, symbol: "H" },
  nitrogen: { color: "nitrogen", radius: 0.064, symbol: "N" },
  oxygen: { color: "oxygen", radius: 0.064, symbol: "O" },
} satisfies Record<
  CombiningVolumesElement,
  {
    color: keyof Pick<
      CombiningVolumesSceneColors,
      "hydrogen" | "nitrogen" | "oxygen"
    >;
    radius: number;
    symbol: string;
  }
>;

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
  {
    atoms: readonly MoleculeAtom[];
    bonds: readonly (readonly [string, string])[];
  }
>;

export function CombiningVolumesScene({
  colors,
  labels,
  modeId,
}: {
  colors: CombiningVolumesSceneColors;
  labels: Pick<CombiningVolumesLabLabels, "volumeUnit">;
  modeId: CombiningVolumesModeId;
}) {
  const model = COMBINING_VOLUMES_MODELS[modeId];

  return (
    <group position={[0, 0.12, 0]} scale={SCENE_SCALE}>
      <GasSet
        colors={colors}
        gases={model.reactants}
        unitLabel={labels.volumeUnit}
        x={REACTANTS_X}
      />

      <ArrowHelper
        arrowSize={0.13}
        color={colors.arrow}
        from={[-0.34, -0.04, 0.04]}
        lineWidth={3}
        to={[0.34, -0.04, 0.04]}
      />

      <GasSet
        colors={colors}
        gases={model.products}
        unitLabel={labels.volumeUnit}
        x={PRODUCTS_X}
      />
    </group>
  );
}

function GasSet({
  colors,
  gases,
  unitLabel,
  x,
}: {
  colors: CombiningVolumesSceneColors;
  gases: readonly CombiningVolumesGasModel[];
  unitLabel: string;
  x: number;
}) {
  const centerOffset = ((gases.length - 1) * COLUMN_GAP) / 2;

  return (
    <group position={[x, 0, 0]}>
      {gases.map((gas, index) => (
        <GasColumn
          colors={colors}
          gas={gas}
          key={gas.id}
          unitLabel={unitLabel}
          x={index * COLUMN_GAP - centerOffset}
        />
      ))}
    </group>
  );
}

function GasColumn({
  colors,
  gas,
  unitLabel,
  x,
}: {
  colors: CombiningVolumesSceneColors;
  gas: CombiningVolumesGasModel;
  unitLabel: string;
  x: number;
}) {
  const height = gas.volumeUnits * VOLUME_UNIT_HEIGHT;
  const volumeUnits = Array.from(
    { length: gas.volumeUnits },
    (_, zeroBased) => ({
      id: `${gas.id}-volume-${zeroBased + 1}`,
      phase: zeroBased * 0.7,
      y: getUnitCenter(zeroBased, gas.volumeUnits),
    })
  );

  return (
    <group position={[x, 0, 0]}>
      <SceneLabel
        color={colors.text}
        fontSize="marker"
        position={[0, height / 2 + 0.22, 0.28]}
      >
        {gas.formulaLabel}
      </SceneLabel>

      <VolumeTube colors={colors} height={height} />

      {volumeUnits.map((unit) => (
        <group key={unit.id} position={[0, unit.y, 0]}>
          <VolumeBand color={colors[gas.fillColor]} />
          <FloatingMolecule
            colors={colors}
            kind={gas.moleculeKind}
            phase={unit.phase}
          />
        </group>
      ))}

      <SceneLabel
        color={colors.text}
        fontSize="marker"
        position={[0, -height / 2 - 0.2, 0.34]}
      >
        {`${gas.volumeUnits} ${unitLabel}`}
      </SceneLabel>
    </group>
  );
}

function VolumeTube({
  colors,
  height,
}: {
  colors: CombiningVolumesSceneColors;
  height: number;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[TUBE_RADIUS, TUBE_RADIUS, height, 48, 1, true]}
        />
        <meshStandardMaterial
          color={colors.glass}
          depthWrite={false}
          opacity={0.18}
          roughness={0.12}
          side={DoubleSide}
          transparent
        />
      </mesh>

      {[-height / 2, height / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[TUBE_RADIUS, 0.012, 12, 48]} />
          <meshStandardMaterial
            color={colors.glass}
            opacity={0.48}
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
          TUBE_RADIUS * 0.78,
          TUBE_RADIUS * 0.78,
          VOLUME_UNIT_HEIGHT * 0.72,
          42,
        ]}
      />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        opacity={0.2}
        transparent
      />
    </mesh>
  );
}

function FloatingMolecule({
  colors,
  kind,
  phase,
}: {
  colors: CombiningVolumesSceneColors;
  kind: CombiningVolumesMoleculeKind;
  phase: number;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y = phase + clock.elapsedTime * 0.28;
  });

  return (
    <group ref={groupRef} scale={0.78}>
      <Molecule colors={colors} kind={kind} />
    </group>
  );
}

function Molecule({
  colors,
  kind,
}: {
  colors: CombiningVolumesSceneColors;
  kind: CombiningVolumesMoleculeKind;
}) {
  const { atoms, bonds } = MOLECULE_SPECS[kind];
  const atomsById = new Map(atoms.map((atomData) => [atomData.id, atomData]));

  return (
    <group>
      {bonds.map(([startId, endId]) => {
        const start = atomsById.get(startId);
        const end = atomsById.get(endId);

        if (!(start && end)) {
          return null;
        }

        return (
          <Line
            color={colors.bond}
            key={`${startId}-${endId}`}
            lineWidth={BOND_LINE_WIDTH}
            points={[start.position, end.position]}
          />
        );
      })}

      {atoms.map((atomData) => (
        <AtomParticle atomData={atomData} colors={colors} key={atomData.id} />
      ))}
    </group>
  );
}

function AtomParticle({
  atomData,
  colors,
}: {
  atomData: MoleculeAtom;
  colors: CombiningVolumesSceneColors;
}) {
  const style = ATOM_STYLE[atomData.element];

  return (
    <group position={atomData.position}>
      <mesh castShadow>
        <sphereGeometry args={[style.radius, 32, 20]} />
        <meshStandardMaterial color={colors[style.color]} roughness={0.34} />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getChemistryParticleLabelFontSize(style.radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(style.radius)}
      >
        {style.symbol}
      </ChemistryParticleLabel>
    </group>
  );
}

function getUnitCenter(index: number, total: number) {
  return (index - (total - 1) / 2) * VOLUME_UNIT_HEIGHT;
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
    bonds: atoms
      .slice(1)
      .map((atomData) => [atoms[0].id, atomData.id] as const),
  };
}
