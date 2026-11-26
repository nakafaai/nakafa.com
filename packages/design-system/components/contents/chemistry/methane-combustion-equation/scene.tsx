import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import { Quaternion, Vector3 } from "three";

type Point = readonly [number, number, number];
type ElementSymbol = "C" | "H" | "O";
type MoleculeId = "carbonDioxide" | "methane" | "oxygen" | "water";
type AtomData = ReturnType<typeof atom>;
type BondData = ReturnType<typeof bond>;
type MoleculeModel = ReturnType<typeof molecule>;
type MoleculeInstance = ReturnType<typeof instance>;

const MOLECULE_SCALE = 0.042;
const DOUBLE_BOND_OFFSET = 0.14;
const NARROW_CANVAS_ASPECT_RATIO = 1.22;
const STAGE_Z = 0.04;
const UP = new Vector3(0, 1, 0);

const MODELS = {
  methane: molecule(
    "\\mathrm{CH_4}",
    [
      atom("c", "C", [0, 0, 0]),
      atom("h1", "H", [0.5541, 0.7996, 0.4965]),
      atom("h2", "H", [0.6833, -0.8134, -0.2536]),
      atom("h3", "H", [-0.7782, -0.3735, 0.6692]),
      atom("h4", "H", [-0.4593, 0.3874, -0.9121]),
    ],
    [bond("c", "h1"), bond("c", "h2"), bond("c", "h3"), bond("c", "h4")]
  ),
  oxygen: molecule(
    "\\mathrm{O_2}",
    [atom("o1", "O", [-0.616, 0, 0]), atom("o2", "O", [0.616, 0, 0])],
    [bond("o1", "o2", 2)]
  ),
  carbonDioxide: molecule(
    "\\mathrm{CO_2}",
    [
      atom("o1", "O", [-1.197, 0, 0]),
      atom("c", "C", [0, 0, 0]),
      atom("o2", "O", [1.197, 0, 0]),
    ],
    [bond("o1", "c", 2), bond("o2", "c", 2)]
  ),
  water: molecule(
    "\\mathrm{H_2O}",
    [
      atom("o", "O", [0, 0, 0]),
      atom("h1", "H", [0.2774, 0.8929, 0.2544]),
      atom("h2", "H", [0.6068, -0.2383, -0.7169]),
    ],
    [bond("o", "h1"), bond("o", "h2")]
  ),
} satisfies Record<MoleculeId, MoleculeModel>;

const INSTANCES = [
  instance("methane-1", "methane", [-0.295, 0.145, STAGE_Z]),
  instance(
    "oxygen-1",
    "oxygen",
    [-0.145, 0.185, STAGE_Z + 0.004],
    [0.08, 0.2, -0.18]
  ),
  instance(
    "oxygen-2",
    "oxygen",
    [-0.145, 0.095, STAGE_Z - 0.004],
    [-0.08, -0.15, 0.18]
  ),
  instance(
    "carbon-dioxide-1",
    "carbonDioxide",
    [0.145, 0.145, STAGE_Z],
    [0, 0.18, 0]
  ),
  instance(
    "water-1",
    "water",
    [0.3, 0.185, STAGE_Z + 0.006],
    [0.18, -0.18, 0.2]
  ),
  instance(
    "water-2",
    "water",
    [0.3, 0.095, STAGE_Z - 0.006],
    [-0.12, 0.2, -0.24]
  ),
] as const;

const FORMULA_LABELS = [
  {
    coefficient: 1,
    id: "methane",
    modelId: "methane",
    position: [-0.295, 0.025, STAGE_Z + 0.11],
  },
  {
    coefficient: 2,
    id: "oxygen",
    modelId: "oxygen",
    position: [-0.145, 0.025, STAGE_Z + 0.11],
  },
  {
    coefficient: 1,
    id: "carbon-dioxide",
    modelId: "carbonDioxide",
    position: [0.145, 0.025, STAGE_Z + 0.11],
  },
  {
    coefficient: 2,
    id: "water",
    modelId: "water",
    position: [0.3, 0.025, STAGE_Z + 0.11],
  },
] as const;

const OPERATOR_LABELS = [
  { id: "reactant-plus", position: [-0.22, 0.025, STAGE_Z + 0.11], text: "+" },
  { id: "product-plus", position: [0.225, 0.025, STAGE_Z + 0.11], text: "+" },
] as const;

const SINGLE_MOLECULE_PINS = [-0.295, 0.145] as const;
const PAIR_MEDALLIONS = [-0.145, 0.3] as const;

export function CombustionCamera() {
  const size = useThree((state) => state.size);
  const narrow = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO);

  return (
    <CameraControls
      cameraPosition={narrow ? [0, 0.38, 1.04] : [0, 0.3, 0.84]}
      cameraTarget={[0, 0.145, STAGE_Z]}
      fov={38}
      maxDistance={1.9}
      minDistance={0.38}
    />
  );
}

export function CombustionScene({
  productsLabel,
  reactantsLabel,
}: {
  readonly productsLabel: string;
  readonly reactantsLabel: string;
}) {
  const labelInk = useLabelInk();
  const { advance, playing } = useSimulationClock(0);
  const spinGroupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (spinGroupRef.current === null) {
      return;
    }
    for (let i = 0; i < spinGroupRef.current.children.length; i += 1) {
      const child = spinGroupRef.current.children[i];
      if (child !== undefined) {
        child.rotation.y = t * (i % 2 === 0 ? 0.85 : -0.75);
      }
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LabBench width={2.8} />
      {/* Dark anodised tabletop reaction demonstration rail */}
      <mesh castShadow position={[0, 0.008, STAGE_Z]} receiveShadow>
        <boxGeometry args={[0.78, 0.016, 0.18]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={BENCH_COLORS.epoxy}
          metalness={0.22}
          roughness={0.5}
        />
      </mesh>
      {Arr.map(SINGLE_MOLECULE_PINS, (px) => (
        <group key={`pin-${px}`} position={[px, 0, STAGE_Z]}>
          <mesh castShadow position={[0, 0.018, 0]}>
            <cylinderGeometry args={[0.016, 0.02, 0.008, 20]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
          <mesh castShadow position={[0, 0.078, 0]}>
            <cylinderGeometry args={[0.004, 0.0055, 0.116, 14]} />
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </mesh>
        </group>
      ))}
      {Arr.map(PAIR_MEDALLIONS, (px) => (
        <mesh castShadow key={`pad-${px}`} position={[px, 0.018, STAGE_Z]}>
          <cylinderGeometry args={[0.026, 0.03, 0.008, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
      ))}
      {/* Central machined steel & glowing combustion arrow */}
      <group position={[0, 0, STAGE_Z]}>
        <mesh castShadow position={[0, 0.074, 0]}>
          <cylinderGeometry args={[0.005, 0.007, 0.12, 16]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.25} />
        </mesh>
        <group position={[0, 0.145, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh castShadow position={[0, -0.014, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.068, 20]} />
            <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.22} />
          </mesh>
          <mesh castShadow position={[0, 0.03, 0]}>
            <coneGeometry args={[0.016, 0.034, 24]} />
            <meshStandardMaterial
              color={BENCH_COLORS.coalGlow}
              emissive={BENCH_COLORS.coalGlow}
              emissiveIntensity={playing ? 0.95 : 0.45}
              metalness={0.35}
              roughness={0.28}
            />
          </mesh>
        </group>
      </group>
      {/* Molecular models */}
      <group ref={spinGroupRef}>
        {Arr.map(INSTANCES, (item) => (
          <Molecule instance={item} key={item.id} />
        ))}
      </group>
      {/* Theme-adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[-0.22, 0.272, STAGE_Z]}
      >
        {reactantsLabel}
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[0.22, 0.272, STAGE_Z]}
      >
        {productsLabel}
      </ThreeLabel>
      {Arr.map(OPERATOR_LABELS, (label) => (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          key={label.id}
          position={label.position}
        >
          <InlineMath math={label.text} />
        </ThreeLabel>
      ))}
      {Arr.map(FORMULA_LABELS, (label) => (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          key={label.id}
          position={label.position}
        >
          <InlineMath
            math={`${label.coefficient === 1 ? "" : label.coefficient}${MODELS[label.modelId].formula}`}
          />
        </ThreeLabel>
      ))}
    </group>
  );
}

function Molecule({ instance: item }: { instance: MoleculeInstance }) {
  const model = MODELS[item.modelId];

  return (
    <group
      position={item.position}
      {...(item.rotation === undefined ? {} : { rotation: item.rotation })}
    >
      <group scale={MOLECULE_SCALE}>
        {Arr.map(model.bonds, (bondData) => {
          const atoms = Option.all([
            Arr.findFirst(model.atoms, ({ id }) => id === bondData.start),
            Arr.findFirst(model.atoms, ({ id }) => id === bondData.end),
          ]);

          if (Option.isNone(atoms)) {
            return null;
          }
          const [start, end] = atoms.value;

          return (
            <Bond
              data={bondData}
              end={end.position}
              key={`${bondData.start}-${bondData.end}`}
              start={start.position}
            />
          );
        })}
        {Arr.map(model.atoms, (atomData) => (
          <Atom data={atomData} key={atomData.id} />
        ))}
      </group>
    </group>
  );
}

function BondCylinder({
  end,
  radius,
  start,
}: {
  readonly end: Point;
  readonly radius: number;
  readonly start: Point;
}) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const color = getCombustionColors(resolvedTheme).bond;
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    return { length: len, mid: a.clone().add(b).multiplyScalar(0.5), quat: q };
  }, [end, start]);

  return (
    <mesh castShadow position={mid} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <MetalMaterial color={color} roughness={0.28} />
    </mesh>
  );
}

function Bond({
  data,
  end,
  start,
}: {
  data: BondData;
  end: Point;
  start: Point;
}) {
  if (data.order !== 2) {
    return <BondCylinder end={end} radius={0.075} start={start} />;
  }

  return (
    <>
      <BondCylinder
        end={offsetY(end, DOUBLE_BOND_OFFSET)}
        radius={0.056}
        start={offsetY(start, DOUBLE_BOND_OFFSET)}
      />
      <BondCylinder
        end={offsetY(end, -DOUBLE_BOND_OFFSET)}
        radius={0.056}
        start={offsetY(start, -DOUBLE_BOND_OFFSET)}
      />
    </>
  );
}

function Atom({ data }: { data: AtomData }) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getCombustionColors(resolvedTheme);

  return (
    <mesh castShadow position={data.position}>
      <sphereGeometry args={[atomRadius(data.element), 36, 24]} />
      <meshPhysicalMaterial
        clearcoat={0.72}
        clearcoatRoughness={0.14}
        color={atomColor(data.element, colors)}
        roughness={0.24}
      />
    </mesh>
  );
}

function atom(id: string, element: ElementSymbol, position: Point) {
  return { element, id, position };
}

function atomColor(element: ElementSymbol, colors: CombustionColors) {
  if (element === "C") {
    return colors.carbon;
  }

  if (element === "H") {
    return colors.hydrogen;
  }

  return colors.oxygen;
}

function atomRadius(element: ElementSymbol) {
  return element === "H" ? 0.24 : 0.34;
}

function bond(start: string, end: string, order: 1 | 2 = 1) {
  return { end, order, start };
}

function instance(
  id: string,
  modelId: MoleculeId,
  position: Point,
  rotation?: Point
) {
  return {
    id,
    modelId,
    position,
    ...(rotation === undefined ? {} : { rotation }),
  };
}

function molecule(
  formula: string,
  atoms: readonly AtomData[],
  bonds: readonly BondData[]
) {
  return { atoms, bonds, formula };
}

function offsetY([x, y, z]: Point, offset: number): Point {
  return [x, y + offset, z];
}

type CombustionColors = ReturnType<typeof getCombustionColors>;

function getCombustionColors(theme?: string) {
  const isDarkTheme = getThemeAppearance(theme) === "dark";

  return {
    bond: isDarkTheme ? getColor("ZINC") : PLOT_COLORS.slate,
    carbon: isDarkTheme ? getColor("ZINC") : PLOT_COLORS.slate,
    hydrogen: isDarkTheme ? getColor("NEUTRAL") : ORIGIN_COLOR.LIGHT,
    oxygen: PLOT_COLORS.pink,
  };
}
