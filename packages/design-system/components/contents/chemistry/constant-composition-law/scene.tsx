import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type {
  ConstantCompositionModeId,
  ConstantCompositionScenePoint,
} from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import {
  ConstantCompositionScenePointSchema,
  EXACT_RATIO_MODE_ID,
  getConstantCompositionSceneColors,
  HYDROGEN_EXCESS_MODE_ID,
  OXYGEN_EXCESS_MODE_ID,
} from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import type { ConstantCompositionLabProps } from "@repo/design-system/components/contents/chemistry/constant-composition-law/lab";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/label";
import { atomSymbol } from "@repo/design-system/components/contents/chemistry/symbol";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getThreeParticleLabelFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { LatheGeometry, Quaternion, Vector2, Vector3 } from "three";

const BEFORE_X = -0.17;
const AFTER_X = 0.17;
const DISH_Z = 0.03;
const DISH_CENTER_Y = 0.125;
const HYDROGEN_RADIUS = 0.017;
const OXYGEN_RADIUS = 0.026;
const UP = new Vector3(0, 1, 0);

const AtomElementSchema = Schema.Literals(["hydrogen", "oxygen"]);
type AtomElement = typeof AtomElementSchema.Type;

const CompositionAtomSchema = Schema.Struct({
  element: AtomElementSchema,
  id: Schema.String,
  position: ConstantCompositionScenePointSchema,
});
type CompositionAtom = typeof CompositionAtomSchema.Type;

const CompositionBondSchema = Schema.Struct({
  end: ConstantCompositionScenePointSchema,
  id: Schema.String,
  start: ConstantCompositionScenePointSchema,
});
type CompositionBond = typeof CompositionBondSchema.Type;

const WATER_ATOMS = [
  { element: "oxygen", id: "water-o", position: [0, 0.008, 0] },
  { element: "hydrogen", id: "water-h-left", position: [-0.044, -0.018, 0.01] },
  {
    element: "hydrogen",
    id: "water-h-right",
    position: [0.044, -0.018, -0.01],
  },
] satisfies CompositionAtom[];

const WATER_BONDS = [
  {
    end: WATER_ATOMS[1].position,
    id: "left-bond",
    start: WATER_ATOMS[0].position,
  },
  {
    end: WATER_ATOMS[2].position,
    id: "right-bond",
    start: WATER_ATOMS[0].position,
  },
] satisfies CompositionBond[];

const CompositionLayoutSchema = Schema.Struct({
  beforeAtoms: Schema.Array(CompositionAtomSchema),
  leftoverAtoms: Schema.Array(CompositionAtomSchema),
});

const SCENE_LAYOUTS = {
  [EXACT_RATIO_MODE_ID]: {
    beforeAtoms: [
      atom("exact-h-1", "hydrogen", [-0.044, -0.016, 0.01]),
      atom("exact-h-2", "hydrogen", [0, 0.038, -0.012]),
      atom("exact-o-1", "oxygen", [0.046, -0.012, 0.008]),
    ],
    leftoverAtoms: [],
  },
  [HYDROGEN_EXCESS_MODE_ID]: {
    beforeAtoms: [
      atom("h-excess-h-1", "hydrogen", [-0.052, -0.018, 0.01]),
      atom("h-excess-h-2", "hydrogen", [-0.008, 0.04, -0.014]),
      atom("h-excess-h-3", "hydrogen", [0.004, -0.048, 0.016]),
      atom("h-excess-o-1", "oxygen", [0.05, -0.01, 0.004]),
    ],
    leftoverAtoms: [atom("leftover-h", "hydrogen", [0.072, -0.036, 0.022])],
  },
  [OXYGEN_EXCESS_MODE_ID]: {
    beforeAtoms: [
      atom("o-excess-h-1", "hydrogen", [-0.05, -0.018, 0.01]),
      atom("o-excess-h-2", "hydrogen", [-0.006, 0.038, -0.014]),
      atom("o-excess-o-1", "oxygen", [0.046, -0.004, 0.004]),
      atom("o-excess-o-2", "oxygen", [0.008, -0.052, 0.018]),
    ],
    leftoverAtoms: [atom("leftover-o", "oxygen", [0.076, -0.034, 0.018])],
  },
} satisfies Record<
  ConstantCompositionModeId,
  typeof CompositionLayoutSchema.Type
>;

function createWatchGlassGeometry() {
  const profile = Arr.map(
    [
      [0.001, 0.004],
      [0.052, 0.005],
      [0.095, 0.013],
      [0.118, 0.026],
      [0.121, 0.028],
      [0.116, 0.029],
      [0.092, 0.017],
      [0.05, 0.009],
      [0.001, 0.008],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 48);
}

function WatchGlassStage({
  children,
  x,
}: {
  readonly children: ReactNode;
  readonly x: number;
}) {
  const dishGeo = useMemo(createWatchGlassGeometry, []);
  useEffect(() => () => dishGeo.dispose(), [dishGeo]);

  return (
    <group position={[x, 0, DISH_Z]}>
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[0.088, 0.094, 0.008, 40]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
      <mesh castShadow geometry={dishGeo} position={[0, 0.004, 0]}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </mesh>
      <group position={[0, DISH_CENTER_Y, 0]}>{children}</group>
    </group>
  );
}

function ReactionPointer() {
  return (
    <group position={[0, 0, DISH_Z]}>
      <mesh castShadow position={[0, 0.005, 0]} receiveShadow>
        <cylinderGeometry args={[0.024, 0.028, 0.01, 24]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.062, 0]}>
        <cylinderGeometry args={[0.0045, 0.005, 0.11, 16]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.25} />
      </mesh>
      <group position={[0, DISH_CENTER_Y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow position={[0, -0.012, 0]}>
          <cylinderGeometry args={[0.0052, 0.0052, 0.056, 20]} />
          <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.24} />
        </mesh>
        <mesh castShadow position={[0, 0.024, 0]}>
          <coneGeometry args={[0.014, 0.028, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function BondCylinder({
  color,
  end,
  start,
}: {
  readonly color: string;
  readonly end: ConstantCompositionScenePoint;
  readonly start: ConstantCompositionScenePoint;
}) {
  const { length, mid, quat } = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    return {
      length: len,
      mid: a.clone().add(b).multiplyScalar(0.5),
      quat: q,
    };
  }, [end, start]);

  return (
    <mesh castShadow position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.0045, 0.0045, length, 16]} />
      <MetalMaterial color={color} roughness={0.28} />
    </mesh>
  );
}

export function ConstantCompositionScene({
  labels,
  modeId,
}: {
  labels: Pick<
    ConstantCompositionLabProps["labels"],
    "after" | "before" | "modes"
  >;
  modeId: ConstantCompositionModeId;
}) {
  const labelInk = useLabelInk();
  const modeLabels = labels.modes[modeId];
  const layout = SCENE_LAYOUTS[modeId];
  const beforeRef = useRef<Group>(null);
  const afterRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (beforeRef.current !== null) {
      beforeRef.current.rotation.y = Math.sin(t * 0.9) * 0.35;
      beforeRef.current.position.y = Math.sin(t * 1.6) * 0.005;
    }
    if (afterRef.current !== null) {
      afterRef.current.rotation.y = t * 0.65;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LabBench width={2.6} />
      <ReactionPointer />
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BEFORE_X, 0.228, DISH_Z]}
      >
        {labels.before}
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[BEFORE_X, 0.025, DISH_Z + 0.13]}
      >
        {modeLabels.readoutBefore}
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[AFTER_X, 0.228, DISH_Z]}
      >
        {labels.after}
      </ThreeLabel>
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        position={[AFTER_X, 0.025, DISH_Z + 0.13]}
      >
        {modeLabels.readoutAfter}
      </ThreeLabel>
      <WatchGlassStage x={BEFORE_X}>
        <group ref={beforeRef}>
          {Arr.map(layout.beforeAtoms, (atomData) => (
            <AtomParticle atomData={atomData} key={atomData.id} />
          ))}
        </group>
      </WatchGlassStage>
      <WatchGlassStage x={AFTER_X}>
        <group ref={afterRef}>
          <WaterMolecule />
          {Arr.map(layout.leftoverAtoms, (atomData) => (
            <LeftoverAtom atomData={atomData} key={atomData.id} />
          ))}
        </group>
      </WatchGlassStage>
    </group>
  );
}

function WaterMolecule() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getConstantCompositionSceneColors(resolvedTheme);

  return (
    <group rotation={[0, -0.22, 0]} scale={1.1}>
      {Arr.map(WATER_BONDS, (bond) => (
        <BondCylinder
          color={colors.bond}
          end={bond.end}
          key={bond.id}
          start={bond.start}
        />
      ))}
      {Arr.map(WATER_ATOMS, (atomData) => (
        <AtomParticle atomData={atomData} key={atomData.id} />
      ))}
    </group>
  );
}

function LeftoverAtom({ atomData }: { atomData: CompositionAtom }) {
  const [x, y, z] = atomData.position;

  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[atomRadius(atomData.element) * 1.38, 0.0022, 12, 40]}
        />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
      </mesh>
      <AtomParticle atomData={{ ...atomData, position: [0, 0, 0] }} />
    </group>
  );
}

function AtomParticle({ atomData }: { atomData: CompositionAtom }) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getConstantCompositionSceneColors(resolvedTheme);
  const radius = atomRadius(atomData.element);
  const color =
    atomData.element === "hydrogen" ? colors.hydrogen : colors.oxygen;

  return (
    <group position={atomData.position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 22]} />
        <meshPhysicalMaterial
          clearcoat={0.72}
          clearcoatRoughness={0.14}
          color={color}
          roughness={0.24}
        />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getThreeParticleLabelFontSize(radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(radius)}
      >
        <InlineMath math={atomSymbol(atomData.element)} />
      </ChemistryParticleLabel>
    </group>
  );
}

function atom(
  id: string,
  element: AtomElement,
  position: ConstantCompositionScenePoint
): CompositionAtom {
  return { element, id, position };
}

function atomRadius(element: AtomElement) {
  return element === "hydrogen" ? HYDROGEN_RADIUS : OXYGEN_RADIUS;
}
