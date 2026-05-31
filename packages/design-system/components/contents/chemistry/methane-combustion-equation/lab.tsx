"use client";

import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { getColor } from "@repo/design-system/lib/color";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Point = readonly [number, number, number];
type ElementSymbol = "C" | "H" | "O";
type MoleculeId = "carbonDioxide" | "methane" | "oxygen" | "water";

interface AtomData {
  element: ElementSymbol;
  id: string;
  position: Point;
}

interface BondData {
  end: string;
  order?: 1 | 2;
  start: string;
}

interface MoleculeModel {
  atoms: readonly AtomData[];
  bonds: readonly BondData[];
  formula: string;
}

interface MoleculeInstance {
  id: string;
  modelId: MoleculeId;
  position: Point;
  rotation?: Point;
}

export interface MethaneCombustionEquationLabProps {
  description: ReactNode;
  labels: {
    equation: ReactNode;
    moleculeView: string;
    products: string;
    reactants: string;
  };
  title: ReactNode;
}

const VIEW = {
  cameraPosition: [0, 2, 5.05],
  cameraTarget: [0, 0.04, 0],
  narrowCameraPosition: [0, 2.6, 6.1],
} satisfies Record<string, Point>;

const MOLECULE_SCALE = 0.36;
const DOUBLE_BOND_OFFSET = 0.035;
const BOND_LINE_WIDTH = 2.8;
const NARROW_CANVAS_ASPECT_RATIO = 1.22;

const MODELS = {
  methane: molecule(
    "CH\u2084",
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
    "O\u2082",
    [atom("o1", "O", [-0.616, 0, 0]), atom("o2", "O", [0.616, 0, 0])],
    [bond("o1", "o2", 2)]
  ),
  carbonDioxide: molecule(
    "CO\u2082",
    [
      atom("o1", "O", [-1.197, 0, 0]),
      atom("c", "C", [0, 0, 0]),
      atom("o2", "O", [1.197, 0, 0]),
    ],
    [bond("o1", "c", 2), bond("o2", "c", 2)]
  ),
  water: molecule(
    "H\u2082O",
    [
      atom("o", "O", [0, 0, 0]),
      atom("h1", "H", [0.2774, 0.8929, 0.2544]),
      atom("h2", "H", [0.6068, -0.2383, -0.7169]),
    ],
    [bond("o", "h1"), bond("o", "h2")]
  ),
} satisfies Record<MoleculeId, MoleculeModel>;

const INSTANCES = [
  instance("methane-1", "methane", [-2.05, 0.1, 0]),
  instance("oxygen-1", "oxygen", [-1.05, 0.44, 0.03], [0.08, 0.2, -0.18]),
  instance("oxygen-2", "oxygen", [-1.05, -0.28, -0.03], [-0.08, -0.15, 0.18]),
  instance("carbon-dioxide-1", "carbonDioxide", [1.12, 0.1, 0], [0, 0.18, 0]),
  instance("water-1", "water", [2.12, 0.44, 0.06], [0.18, -0.18, 0.2]),
  instance("water-2", "water", [2.12, -0.28, -0.06], [-0.12, 0.2, -0.24]),
] as const;

export function MethaneCombustionEquationLab({
  description,
  labels,
  title,
}: MethaneCombustionEquationLabProps) {
  const { resolvedTheme } = useTheme();
  const colors = getCombustionColors(resolvedTheme);

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <section
          aria-label={labels.moleculeView}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 42, position: VIEW.cameraPosition }}
            frameloop="always"
          >
            <Suspense>
              <CombustionCamera />
              <ambientLight intensity={0.72} />
              <hemisphereLight color={colors.text} groundColor={colors.bond} />
              <directionalLight intensity={1.28} position={[4.2, 5.4, 4.8]} />
              <CombustionScene colors={colors} labels={labels} />
            </Suspense>
          </ThreeCanvas>
        </section>

        <p className="text-muted-foreground text-sm">{labels.equation}</p>
      </CardContent>
    </Card>
  );
}

function CombustionScene({
  colors,
  labels,
}: {
  colors: CombustionColors;
  labels: MethaneCombustionEquationLabProps["labels"];
}) {
  return (
    <group position={[0, -0.02, 0]} scale={1.1}>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[-1.58, 1.04, 0.2]}
      >
        {labels.reactants}
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[1.58, 1.04, 0.2]}
      >
        {labels.products}
      </SceneLabel>
      <ReactionArrow color={colors.text} />
      <SceneLabel
        color={colors.text}
        fontSize={0.14}
        position={[-1.55, -0.82, 0.3]}
      >
        +
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={0.14}
        position={[1.55, -0.82, 0.3]}
      >
        +
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[-2.05, -0.68, 0.3]}
      >
        CH₄
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[-1.05, -0.68, 0.3]}
      >
        2O₂
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[1.12, -0.68, 0.3]}
      >
        CO₂
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[2.12, -0.68, 0.3]}
      >
        2H₂O
      </SceneLabel>
      {INSTANCES.map((item) => (
        <Molecule colors={colors} instance={item} key={item.id} />
      ))}
    </group>
  );
}

function ReactionArrow({ color }: { color: string }) {
  return (
    <SceneLabel color={color} fontSize={0.26} position={[0, 0.62, 0.32]}>
      ⟶
    </SceneLabel>
  );
}

function Molecule({
  colors,
  instance: item,
}: {
  colors: CombustionColors;
  instance: MoleculeInstance;
}) {
  const model = MODELS[item.modelId];
  const atomsById = new Map(
    model.atoms.map((atomData) => [atomData.id, atomData])
  );

  return (
    <group position={item.position} rotation={item.rotation}>
      <group scale={MOLECULE_SCALE}>
        {model.bonds.map((bondData) => {
          const start = atomsById.get(bondData.start);
          const end = atomsById.get(bondData.end);

          if (!(start && end)) {
            return null;
          }

          return (
            <Bond
              color={colors.bond}
              data={bondData}
              end={end.position}
              key={`${bondData.start}-${bondData.end}`}
              start={start.position}
            />
          );
        })}
        {model.atoms.map((atomData) => (
          <Atom colors={colors} data={atomData} key={atomData.id} />
        ))}
      </group>
    </group>
  );
}

function Bond({
  color,
  data,
  end,
  start,
}: {
  color: string;
  data: BondData;
  end: Point;
  start: Point;
}) {
  if (data.order !== 2) {
    return (
      <Line color={color} lineWidth={BOND_LINE_WIDTH} points={[start, end]} />
    );
  }

  return (
    <>
      <Line
        color={color}
        lineWidth={BOND_LINE_WIDTH}
        points={[
          offsetY(start, DOUBLE_BOND_OFFSET),
          offsetY(end, DOUBLE_BOND_OFFSET),
        ]}
      />
      <Line
        color={color}
        lineWidth={BOND_LINE_WIDTH}
        points={[
          offsetY(start, -DOUBLE_BOND_OFFSET),
          offsetY(end, -DOUBLE_BOND_OFFSET),
        ]}
      />
    </>
  );
}

function Atom({ colors, data }: { colors: CombustionColors; data: AtomData }) {
  return (
    <mesh castShadow position={data.position}>
      <sphereGeometry args={[atomRadius(data.element), 36, 24]} />
      <meshStandardMaterial
        color={atomColor(data.element, colors)}
        roughness={0.38}
      />
    </mesh>
  );
}

function CombustionCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? VIEW.narrowCameraPosition
    : VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={VIEW.cameraTarget}
      maxAzimuthAngle={Math.PI / 18}
      maxDistance={8.6}
      maxPolarAngle={Math.PI / 2.45}
      minAzimuthAngle={-Math.PI / 18}
      minDistance={3.1}
      minPolarAngle={Math.PI / 2.95}
    />
  );
}

function atom(id: string, element: ElementSymbol, position: Point): AtomData {
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

function bond(start: string, end: string, order: 1 | 2 = 1): BondData {
  return { end, order, start };
}

function instance(
  id: string,
  modelId: MoleculeId,
  position: Point,
  rotation?: Point
): MoleculeInstance {
  return { id, modelId, position, rotation };
}

function molecule(
  formula: string,
  atoms: readonly AtomData[],
  bonds: readonly BondData[]
): MoleculeModel {
  return { atoms, bonds, formula };
}

function offsetY([x, y, z]: Point, offset: number): Point {
  return [x, y + offset, z];
}

type CombustionColors = ReturnType<typeof getCombustionColors>;

function getCombustionColors(theme?: string) {
  const isDarkTheme = theme === "dark";

  return {
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    carbon: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    hydrogen: isDarkTheme ? getColor("NEUTRAL") : ORIGIN_COLOR.LIGHT,
    oxygen: getColor("RED"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}
