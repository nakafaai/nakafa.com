"use client";

import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Option } from "effect";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Point = readonly [number, number, number];
type ElementSymbol = "C" | "H" | "O";
type MoleculeId = "carbonDioxide" | "methane" | "oxygen" | "water";
/** One atom of a molecule model, placed in the molecule's own space. */
type AtomData = ReturnType<typeof atom>;
/** A single or double bond between two atoms of one molecule. */
type BondData = ReturnType<typeof bond>;
/** A molecule's formula, its atoms, and the bonds between them. */
type MoleculeModel = ReturnType<typeof molecule>;
/** One molecule of a model, placed and turned in the equation. */
type MoleculeInstance = ReturnType<typeof instance>;

interface MethaneCombustionEquationLabProps {
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
  cameraPosition: [0, 0.62, 5.45],
  cameraTarget: [0, 0.08, 0],
  narrowCameraPosition: [0, 0.72, 6.2],
} satisfies Record<string, Point>;

const SCENE_POSITION = [0, 0.42, 0] satisfies Point;
const SCENE_SCALE = 0.95;
const MOLECULE_SCALE = 0.39;
const DOUBLE_BOND_OFFSET = 0.035;
const BOND_LINE_WIDTH = 2.8;
const NARROW_CANVAS_ASPECT_RATIO = 1.22;

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
  instance("methane-1", "methane", [-2.28, 0.06, 0]),
  instance("oxygen-1", "oxygen", [-1.15, 0.44, 0.03], [0.08, 0.2, -0.18]),
  instance("oxygen-2", "oxygen", [-1.15, -0.32, -0.03], [-0.08, -0.15, 0.18]),
  instance("carbon-dioxide-1", "carbonDioxide", [1.12, 0.06, 0], [0, 0.18, 0]),
  instance("water-1", "water", [2.36, 0.44, 0.06], [0.18, -0.18, 0.2]),
  instance("water-2", "water", [2.36, -0.32, -0.06], [-0.12, 0.2, -0.24]),
] as const;

const FORMULA_LABELS = [
  {
    coefficient: 1,
    id: "methane",
    modelId: "methane",
    position: [-2.28, -0.92, 0.36],
  },
  {
    coefficient: 2,
    id: "oxygen",
    modelId: "oxygen",
    position: [-1.15, -0.92, 0.36],
  },
  {
    coefficient: 1,
    id: "carbon-dioxide",
    modelId: "carbonDioxide",
    position: [1.12, -0.92, 0.36],
  },
  {
    coefficient: 2,
    id: "water",
    modelId: "water",
    position: [2.36, -0.92, 0.36],
  },
] as const;

const OPERATOR_LABELS = [
  { id: "reactant-plus", text: "+", position: [-1.72, -0.92, 0.36] },
  { id: "product-plus", text: "+", position: [1.74, -0.92, 0.36] },
] as const;

export function MethaneCombustionEquationLab({
  description,
  labels,
  title,
}: MethaneCombustionEquationLabProps) {
  const { resolvedTheme } = useTheme();
  const colors = getCombustionColors(resolvedTheme);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <VisualCardScene
          aria-label={labels.moleculeView}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <CombustionCamera />
              <ambientLight intensity={0.72} />
              <hemisphereLight color={colors.text} groundColor={colors.bond} />
              <directionalLight intensity={1.28} position={[4.2, 5.4, 4.8]} />
              <CombustionScene colors={colors} labels={labels} />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>

        <p className="text-muted-foreground text-sm">{labels.equation}</p>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
    <group position={SCENE_POSITION} scale={SCENE_SCALE}>
      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[-1.72, 0.92, 0.36]}
      >
        {labels.reactants}
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[1.72, 0.92, 0.36]}
      >
        {labels.products}
      </ThreeLabel>
      {Arr.map(INSTANCES, (item) => (
        <Molecule colors={colors} instance={item} key={item.id} />
      ))}
      {Arr.map(OPERATOR_LABELS, (label) => (
        <ThreeLabel
          color={colors.text}
          fontSize="reading"
          key={label.id}
          position={label.position}
        >
          <InlineMath math={label.text} />
        </ThreeLabel>
      ))}
      {Arr.map(FORMULA_LABELS, (label) => (
        <ThreeLabel
          color={colors.text}
          fontSize="reading"
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

function Molecule({
  colors,
  instance: item,
}: {
  colors: CombustionColors;
  instance: MoleculeInstance;
}) {
  const model = MODELS[item.modelId];

  return (
    <group
      position={item.position}
      {...(item.rotation === undefined
        ? {}
        : {
            rotation: item.rotation,
          })}
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
              color={colors.bond}
              data={bondData}
              end={end.position}
              key={`${bondData.start}-${bondData.end}`}
              start={start.position}
            />
          );
        })}
        {Arr.map(model.atoms, (atomData) => (
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
      fov={42}
      framing="content"
    />
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
    bond: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    carbon: isDarkTheme ? getColor("ZINC") : getColor("SLATE"),
    hydrogen: isDarkTheme ? getColor("NEUTRAL") : ORIGIN_COLOR.LIGHT,
    oxygen: getColor("RED"),
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
  };
}
