import type { MarbleColor } from "@repo/design-system/components/contents/mathematics/marble/draw";
import { JAR } from "@repo/design-system/components/contents/mathematics/marble/jar";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  MetalMaterial,
  VesselGlassMaterial,
} from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { MARBLE_COLORS } from "@repo/design-system/lib/material/marble";
import { Array as Arr } from "effect";
import { type Ref, useImperativeHandle, useMemo, useRef } from "react";
import {
  DoubleSide,
  LatheGeometry,
  type Material,
  type Mesh,
  Vector2,
} from "three";

/** The tally board keeps the colours of this many trials, newest on the right. */
export const TALLY_COLUMNS = 10;

/** Where the tally board lies, in front of the jar, in metres. */
const BOARD = { at: [0.005, 0, 0.12], depth: 0.076, width: 0.27 } as const;

/** How far each row of holes lies from the board's middle line. */
const ROW = 0.019;

/** The jar's outer radius, its neck's outer radius, and how tall its neck stands. */
const OUTER = JAR.innerRadius + JAR.wall;
const NECK = 0.046;
const NECK_HEIGHT = 0.014;

/**
 * The jar's wall as one closed outline turned on a lathe: the outside from
 * the middle of the base up to the lip, then the inside back down, so the
 * glass has its real thickness everywhere, with rounded corners where a
 * pressed jar has them.
 */
const JAR_OUTLINE = [
  [0, 0],
  [OUTER - 0.007, 0],
  [OUTER - 0.002, 0.0015],
  [OUTER, 0.007],
  [OUTER, JAR.height - NECK_HEIGHT - 0.016],
  [OUTER - 0.003, JAR.height - NECK_HEIGHT - 0.005],
  [NECK, JAR.height - NECK_HEIGHT],
  [NECK, JAR.height - 0.001],
  [NECK - 0.0015, JAR.height],
  [NECK - JAR.wall + 0.001, JAR.height],
  [NECK - JAR.wall, JAR.height - 0.001],
  [NECK - JAR.wall, JAR.height - NECK_HEIGHT + 0.002],
  [JAR.innerRadius - 0.003, JAR.height - NECK_HEIGHT - 0.007],
  [JAR.innerRadius, JAR.height - NECK_HEIGHT - 0.018],
  [JAR.innerRadius, JAR.floor + 0.004],
  [JAR.innerRadius - 0.004, JAR.floor],
  [0, JAR.floor],
] as const;

/** A clear one litre storage jar, open, its screw thread moulded round the neck. */
export function MarbleJar() {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(JAR_OUTLINE, ([radius, height]) => new Vector2(radius, height)),
        96
      ),
    []
  );
  return (
    <group>
      <mesh geometry={geometry}>
        <VesselGlassMaterial
          color={MARBLE_COLORS.jarGlass}
          thickness={JAR.wall}
          tint={MARBLE_COLORS.jarTint}
        />
      </mesh>
      {Arr.map([0.004, 0.009], (drop) => (
        <mesh
          key={drop}
          position={[0, JAR.height - drop, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[NECK + 0.0004, 0.0009, 8, 96]} />
          <VesselGlassMaterial
            color={MARBLE_COLORS.jarGlass}
            thickness={0.0018}
            tint={MARBLE_COLORS.jarTint}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The jar's tinplate screw lid, lying top up beside it. */
export function JarLid() {
  return (
    <group>
      <mesh castShadow position={[0, 0.0065, 0]} receiveShadow>
        <cylinderGeometry
          args={[NECK + 0.004, NECK + 0.004, 0.013, 96, 1, true]}
        />
        <MetalMaterial color={MARBLE_COLORS.lid} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 0.0128, 0]}>
        <cylinderGeometry args={[NECK + 0.0035, NECK + 0.004, 0.0012, 96]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.08}
          color={MARBLE_COLORS.lidLacquer}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/** The profile of a shallow stoneware dish, rim to foot, turned on a lathe. */
const DISH_OUTLINE = [
  [0, 0.004],
  [0.03, 0.005],
  [0.04, 0.009],
  [0.046, 0.016],
  [0.048, 0.017],
  [0.044, 0.008],
  [0.034, 0.001],
  [0.032, 0],
  [0, 0],
] as const;

/** A white glazed dish, where a marble kept out of the jar waits. */
export function MarbleDish() {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(
          DISH_OUTLINE,
          ([radius, height]) => new Vector2(radius, height)
        ),
        72
      ),
    []
  );
  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[0, -0.009, 0]}
      receiveShadow
    >
      <meshPhysicalMaterial
        clearcoat={0.8}
        clearcoatRoughness={0.12}
        color={MARBLE_COLORS.dish}
        roughness={0.35}
        side={DoubleSide}
      />
    </mesh>
  );
}

/** Shows the pegs of the trials finished, plus the pegs already set of the trial under way. */
export type TallyUpdate = (finished: number, partial: number) => void;

/**
 * A walnut tally board with two rows of drilled holes: the top row takes a
 * peg in the colour of each trial's first marble, the bottom row the second.
 * It keeps the last ten trials, newest on the right. The scene sets the pegs
 * on every frame through `ref`, so the board never re-renders while playing.
 */
export function TallyBoard({
  colors,
  columns,
  materials,
  ref,
}: {
  readonly colors: readonly {
    readonly first: MarbleColor;
    readonly second: MarbleColor;
  }[];
  readonly columns: number;
  readonly materials: Readonly<Record<MarbleColor, Material>>;
  readonly ref: Ref<TallyUpdate>;
}) {
  const pegs = useRef<(Mesh | null)[]>([]);
  const ink = getColor("WHITE");
  const step = (BOARD.width - 0.04) / columns;
  const left = -BOARD.width / 2 + 0.03;

  useImperativeHandle(
    ref,
    () => (finished, partial) => {
      const shown = finished + (partial > 0 ? 1 : 0);
      const start = Math.max(0, shown - columns);
      Arr.forEach(Arr.range(0, columns * 2 - 1), (index) => {
        const peg = pegs.current[index];
        if (!peg) {
          return;
        }
        const column = Math.floor(index / 2);
        const row = index % 2;
        const trial = start + column;
        const set =
          trial < finished ||
          (trial === finished && partial > row && trial < colors.length);
        const color = colors[trial];
        peg.visible = set && color !== undefined;
        if (color !== undefined) {
          peg.material = materials[row === 0 ? color.first : color.second];
        }
      });
    },
    [colors, columns, materials]
  );

  return (
    <group position={[BOARD.at[0], BOARD.at[1], BOARD.at[2]]}>
      <mesh castShadow position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[BOARD.width, 0.012, BOARD.depth]} />
        <SurfaceMaterial
          color={MARBLE_COLORS.walnut}
          repeat={[2, 1]}
          roughness={0.45}
          surface="wood"
        />
      </mesh>
      {Arr.map([0, 1] as const, (row) => (
        <ThreeLabel
          color={ink}
          fontSize="compact"
          key={row}
          outlineColor={MARBLE_COLORS.walnutHole}
          outlineWidth={0.0012}
          position={[-BOARD.width / 2 + 0.011, 0.016, row === 0 ? -ROW : ROW]}
        >
          {String(row + 1)}
        </ThreeLabel>
      ))}
      {Arr.flatMap(Arr.range(0, columns - 1), (column) =>
        Arr.map([0, 1] as const, (row) => {
          const x = left + (column + 0.5) * step;
          const z = row === 0 ? -ROW : ROW;
          return (
            <group key={`${column}-${row}`} position={[x, 0.012, z]}>
              <mesh position={[0, 0.0002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.0042, 24]} />
                <meshStandardMaterial
                  color={MARBLE_COLORS.walnutHole}
                  roughness={0.9}
                />
              </mesh>
              <mesh
                castShadow
                position={[0, 0.0035, 0]}
                ref={(mesh) => {
                  pegs.current[column * 2 + row] = mesh;
                }}
                visible={false}
              >
                <capsuleGeometry args={[0.0036, 0.006, 6, 16]} />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
}
