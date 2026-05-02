import { Line } from "@react-three/drei";
import {
  type ConstantCompositionLabLabels,
  type ConstantCompositionModeId,
  type ConstantCompositionSceneColors,
  type ConstantCompositionScenePoint,
  EXACT_RATIO_MODE_ID,
  HYDROGEN_EXCESS_MODE_ID,
  OXYGEN_EXCESS_MODE_ID,
} from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import {
  CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH,
  ChemistryParticleLabel,
  getChemistryParticleLabelFontSize,
  getChemistryParticleLabelPosition,
} from "@repo/design-system/components/contents/chemistry/particle-label";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import type { ReactNode } from "react";

const BEFORE_X = -1.08;
const AFTER_X = 1.08;
const STAGE_LABEL_Y = 1.03;
const READOUT_Y = -0.86;
const SCENE_SCALE = 1.25;
const HYDROGEN_RADIUS = 0.095;
const OXYGEN_RADIUS = 0.15;
const BOND_LINE_WIDTH = 2.5;

const WATER_ATOMS = [
  {
    element: "oxygen",
    id: "water-o",
    position: [0, 0.02, 0],
  },
  {
    element: "hydrogen",
    id: "water-h-left",
    position: [-0.24, -0.1, 0.06],
  },
  {
    element: "hydrogen",
    id: "water-h-right",
    position: [0.24, -0.1, -0.06],
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

const SCENE_LAYOUTS = {
  [EXACT_RATIO_MODE_ID]: {
    beforeAtoms: [
      atom("exact-h-1", "hydrogen", [-0.24, -0.12, 0.04]),
      atom("exact-h-2", "hydrogen", [0, 0.2, -0.06]),
      atom("exact-o-1", "oxygen", [0.26, -0.09, 0.04]),
    ],
    leftoverAtoms: [],
  },
  [HYDROGEN_EXCESS_MODE_ID]: {
    beforeAtoms: [
      atom("h-excess-h-1", "hydrogen", [-0.3, -0.14, 0.04]),
      atom("h-excess-h-2", "hydrogen", [-0.06, 0.22, -0.08]),
      atom("h-excess-h-3", "hydrogen", [0.02, -0.34, 0.08]),
      atom("h-excess-o-1", "oxygen", [0.28, -0.08, 0.02]),
    ],
    leftoverAtoms: [atom("leftover-h", "hydrogen", [0.48, -0.2, 0.08])],
  },
  [OXYGEN_EXCESS_MODE_ID]: {
    beforeAtoms: [
      atom("o-excess-h-1", "hydrogen", [-0.28, -0.14, 0.04]),
      atom("o-excess-h-2", "hydrogen", [-0.04, 0.2, -0.08]),
      atom("o-excess-o-1", "oxygen", [0.25, -0.04, 0.02]),
      atom("o-excess-o-2", "oxygen", [0.05, -0.38, 0.1]),
    ],
    leftoverAtoms: [atom("leftover-o", "oxygen", [0.5, -0.19, 0.06])],
  },
} satisfies Record<
  ConstantCompositionModeId,
  {
    beforeAtoms: readonly CompositionAtom[];
    leftoverAtoms: readonly CompositionAtom[];
  }
>;

type AtomElement = "hydrogen" | "oxygen";

interface CompositionAtom {
  element: AtomElement;
  id: string;
  position: ConstantCompositionScenePoint;
}

interface CompositionBond {
  end: ConstantCompositionScenePoint;
  id: string;
  start: ConstantCompositionScenePoint;
}

export function ConstantCompositionScene({
  colors,
  labels,
  modeId,
}: {
  colors: ConstantCompositionSceneColors;
  labels: Pick<ConstantCompositionLabLabels, "after" | "before" | "modes">;
  modeId: ConstantCompositionModeId;
}) {
  const modeLabels = labels.modes[modeId];
  const layout = SCENE_LAYOUTS[modeId];

  return (
    <group position={[0, -0.04, 0]} scale={SCENE_SCALE}>
      <CompositionStage
        colors={colors}
        readout={modeLabels.readoutBefore}
        title={labels.before}
        x={BEFORE_X}
      >
        {layout.beforeAtoms.map((atomData) => (
          <AtomParticle atomData={atomData} colors={colors} key={atomData.id} />
        ))}
      </CompositionStage>

      <ArrowHelper
        arrowSize={0.13}
        color={colors.arrow}
        from={[-0.38, 0, 0.04]}
        lineWidth={3}
        to={[0.38, 0, 0.04]}
      />

      <CompositionStage
        colors={colors}
        readout={modeLabels.readoutAfter}
        title={labels.after}
        x={AFTER_X}
      >
        <WaterMolecule colors={colors} />
        {layout.leftoverAtoms.map((atomData) => (
          <LeftoverAtom atomData={atomData} colors={colors} key={atomData.id} />
        ))}
      </CompositionStage>
    </group>
  );
}

function CompositionStage({
  children,
  colors,
  readout,
  title,
  x,
}: {
  children: ReactNode;
  colors: ConstantCompositionSceneColors;
  readout: string;
  title: string;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize="compact"
        position={[0, STAGE_LABEL_Y, 0.28]}
      >
        {title}
      </SceneLabel>

      {children}

      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize="compact"
        position={[0, READOUT_Y, 0.5]}
      >
        {readout}
      </SceneLabel>
    </group>
  );
}

function WaterMolecule({ colors }: { colors: ConstantCompositionSceneColors }) {
  return (
    <group rotation={[0, -0.24, 0]} scale={1.12}>
      {WATER_BONDS.map((bond) => (
        <Line
          color={colors.bond}
          key={bond.id}
          lineWidth={BOND_LINE_WIDTH}
          points={[bond.start, bond.end]}
        />
      ))}
      {WATER_ATOMS.map((atomData) => (
        <AtomParticle atomData={atomData} colors={colors} key={atomData.id} />
      ))}
    </group>
  );
}

function LeftoverAtom({
  atomData,
  colors,
}: {
  atomData: CompositionAtom;
  colors: ConstantCompositionSceneColors;
}) {
  const [x, y, z] = atomData.position;

  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[atomRadius(atomData.element) * 1.32, 0.01, 12, 48]}
        />
        <meshStandardMaterial color={colors.bond} opacity={0.62} transparent />
      </mesh>
      <AtomParticle
        atomData={{
          ...atomData,
          position: [0, 0, 0],
        }}
        colors={colors}
      />
    </group>
  );
}

function AtomParticle({
  atomData,
  colors,
}: {
  atomData: CompositionAtom;
  colors: ConstantCompositionSceneColors;
}) {
  const radius = atomRadius(atomData.element);
  const color =
    atomData.element === "hydrogen" ? colors.hydrogen : colors.oxygen;

  return (
    <group position={atomData.position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial color={color} roughness={0.34} />
      </mesh>
      <ChemistryParticleLabel
        color={colors.sphereText}
        fontSize={getChemistryParticleLabelFontSize(radius)}
        outlineColor={colors.sphereTextOutline}
        outlineWidth={CHEMISTRY_PARTICLE_LABEL_OUTLINE_WIDTH}
        position={getChemistryParticleLabelPosition(radius)}
      >
        {atomSymbol(atomData.element)}
      </ChemistryParticleLabel>
    </group>
  );
}

function atom(
  id: string,
  element: AtomElement,
  position: ConstantCompositionScenePoint
): CompositionAtom {
  return {
    element,
    id,
    position,
  };
}

function atomRadius(element: AtomElement) {
  return element === "hydrogen" ? HYDROGEN_RADIUS : OXYGEN_RADIUS;
}

function atomSymbol(element: AtomElement) {
  return element === "hydrogen" ? "H" : "O";
}
