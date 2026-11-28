import { liquidMeniscus } from "@repo/design-system/components/contents/chemistry/glassware";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import type { Blade } from "@repo/design-system/components/three/flora/blade";
import { Foliage } from "@repo/design-system/components/three/flora/foliage";
import {
  joinMeshes,
  limbMesh,
  smoothPath,
} from "@repo/design-system/components/three/flora/limb";
import { Soil } from "@repo/design-system/components/three/flora/soil";
import { solidOf } from "@repo/design-system/components/three/flora/solid";
import { Turn } from "@repo/design-system/components/three/form/part";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";

/** How wide the vessel is inside, and where the stem starts and ends. */
const BORE = 0.18;
const FOOT = 0.14;
const CROWN = 1.2;

/** One leaf of the shoot the vessel feeds: broad, toothed and veined. */
const LEAF: Blade = {
  arch: 0.24,
  columns: 8,
  fold: 0.24,
  length: 1,
  outline: "ovate",
  relief: 0.03,
  rows: 14,
  teeth: 12,
  veins: 8,
  wave: 0.14,
  width: 0.58,
};

/** The two leaves at the top of the stem, as the numbers that place a leaf each. */
const LEAVES = [
  ...[-0.03, CROWN, 0.02, -0.93, 0.34, 0.14, 0.33, 0.94, -0.05, 0.62, 0.3],
  ...[
    0.03,
    CROWN + 0.02,
    0.02,
    0.92,
    0.36,
    0.16,
    -0.35,
    0.93,
    -0.06,
    0.58,
    0.8,
  ],
];

/** A straight upright axis from `from` to `to`, laid out in enough places to carry relief. */
function upright(from: number, to: number) {
  return Arr.makeBy(
    12,
    (step) => [0, from + ((to - from) * step) / 11, 0] as const
  );
}

/** The woody stem cut open along its length: the back half of its bark, and the pale sapwood inside it. */
function useStem() {
  const stem = useMemo(
    () => ({
      bark: solidOf(
        limbMesh({
          arc: 0.5,
          base: 0.34,
          flare: 0.16,
          furrow: 0.16,
          path: upright(FOOT, CROWN),
          seed: 4,
          sides: 48,
          tip: 0.31,
        })
      ),
      roots: solidOf(
        joinMeshes(
          Arr.makeBy(11, (root) => {
            const turn = (root / 11) * 2 * Math.PI + chanceAt(root, 1, 6);
            const reach = 0.3 + 0.2 * chanceAt(root, 2, 6);
            return limbMesh({
              arc: 1,
              base: 0.05 + 0.03 * chanceAt(root, 3, 6),
              flare: 0.5,
              furrow: 0.2,
              path: smoothPath(
                [
                  [Math.cos(turn) * 0.16, FOOT + 0.08, Math.sin(turn) * 0.16],
                  [
                    Math.cos(turn) * (0.2 + reach * 0.4),
                    FOOT - 0.02,
                    Math.sin(turn) * (0.2 + reach * 0.4),
                  ],
                  [
                    Math.cos(turn + 0.2) * (0.2 + reach * 0.8),
                    FOOT - 0.07,
                    Math.sin(turn + 0.2) * (0.2 + reach * 0.8),
                  ],
                  [
                    Math.cos(turn + 0.3) * (0.2 + reach),
                    FOOT - 0.14,
                    Math.sin(turn + 0.3) * (0.2 + reach),
                  ],
                ],
                12
              ),
              seed: root,
              sides: 10,
              tip: 0.008,
            });
          })
        )
      ),
      wood: solidOf(
        limbMesh({
          arc: 0.5,
          base: 0.3,
          flare: 0.1,
          furrow: 0.02,
          path: upright(FOOT, CROWN - 0.005),
          seed: 5,
          sides: 48,
          tip: 0.28,
        })
      ),
    }),
    []
  );
  useEffect(
    () => () => {
      stem.bark.dispose();
      stem.roots.dispose();
      stem.wood.dispose();
    },
    [stem]
  );
  return stem;
}

/**
 * The lignin a vessel lays inside its wall as it matures, from the oldest
 * part at the foot up: separate rings, then a spiral, then a wall that is
 * solid but for its pits. Rings and spiral let a young vessel stretch.
 */
function useLignin() {
  const lignin = useMemo(() => {
    const ring = (y: number) =>
      new CatmullRomCurve3(
        Arr.makeBy(24, (step) => {
          const turn = (step / 24) * 2 * Math.PI;
          return new Vector3(Math.cos(turn) * BORE, y, Math.sin(turn) * BORE);
        }),
        true
      );
    const spiral = new CatmullRomCurve3(
      Arr.makeBy(97, (step) => {
        const turn = (step / 12) * 2 * Math.PI;
        return new Vector3(
          Math.cos(turn) * BORE,
          0.52 + (0.34 * step) / 96,
          Math.sin(turn) * BORE
        );
      })
    );
    return {
      pits: Arr.flatMap(Arr.range(0, 5), (row) =>
        Arr.map(Arr.range(0, 8), (pit) => {
          const turn = ((pit + 0.5 * (row % 2)) / 9) * Math.PI + Math.PI;
          return {
            id: `${row}-${pit}`,
            place: [
              Math.cos(turn) * (BORE + 0.002),
              0.92 + row * 0.05,
              Math.sin(turn) * (BORE + 0.002),
            ] as const,
            turn,
          };
        })
      ),
      rings: Arr.map(
        [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
        (y) => new TubeGeometry(ring(y), 48, 0.012, 8, true)
      ),
      spiral: new TubeGeometry(spiral, 240, 0.012, 8, false),
    };
  }, []);
  useEffect(
    () => () => {
      lignin.spiral.dispose();
      Arr.forEach(lignin.rings, (ring) => ring.dispose());
    },
    [lignin]
  );
  return lignin;
}

/** A pair of guard cells on the leaf: two bent sausages that part to leave a pore between them. */
function useGuards() {
  const guards = useMemo(
    () =>
      solidOf(
        joinMeshes(
          Arr.map([-1, 1], (side) =>
            limbMesh({
              arc: 1,
              base: 0.02,
              flare: 0,
              furrow: 0,
              path: smoothPath(
                [
                  [0, 0, -0.06],
                  [side * 0.034, 0, -0.03],
                  [side * 0.04, 0, 0],
                  [side * 0.034, 0, 0.03],
                  [0, 0, 0.06],
                ],
                16
              ),
              seed: side + 2,
              sides: 12,
              tip: 0.02,
            })
          )
        )
      ),
    []
  );
  useEffect(() => () => guards.dispose(), [guards]);
  return guards;
}

/**
 * A woody stem cut open along its length to show one xylem vessel: a dead,
 * hollow tube held open by lignin (rings, a spiral, then a pitted wall), the
 * unbroken column of water inside it with its meniscus, the roots that take
 * the water up from moist soil, and the leaves whose open stomata let it go.
 *
 * @param columnHeight - How high the water stands in the vessel
 * @param reachesTop - Whether the water reaches the leaves and leaves them as vapour
 */
export function XylemVesselCutaway({
  columnHeight,
  reachesTop,
}: {
  readonly columnHeight: number;
  readonly reachesTop: boolean;
}) {
  const stem = useStem();
  const lignin = useLignin();
  const guards = useGuards();
  const waterProfile = [
    [0, 0.18],
    [BORE - 0.012, 0.18],
    ...liquidMeniscus(BORE - 0.012, 0.18 + columnHeight),
    [0.001, 0.18 + columnHeight],
  ] as const;

  return (
    <group>
      <Soil count={900} heap={0.13} radius={0.62} seed={11} wet={0.9} />
      <mesh castShadow geometry={stem.roots} receiveShadow>
        <SurfaceMaterial
          bump={0.8}
          color={FLORA_COLORS.rootSkin}
          repeat={[2, 2]}
          roughness={0.8}
          surface="bark"
        />
      </mesh>
      <mesh castShadow geometry={stem.bark} receiveShadow>
        <SurfaceMaterial
          bump={1}
          color={FLORA_COLORS.barkGrey}
          repeat={[3, 1]}
          roughness={0.95}
          side={DoubleSide}
          surface="bark"
        />
      </mesh>
      <mesh geometry={stem.wood} receiveShadow>
        <SurfaceMaterial
          bump={0.5}
          color={FLORA_COLORS.woodEarly}
          repeat={[2, 5]}
          roughness={0.75}
          side={DoubleSide}
          surface="wood"
        />
      </mesh>

      {/* The lignin of the vessel wall: rings at the foot, a spiral, then pits */}
      {Arr.map(lignin.rings, (ring) => (
        <mesh castShadow geometry={ring} key={ring.uuid}>
          <SurfaceMaterial
            bump={0.4}
            color={FLORA_COLORS.ligninRing}
            repeat={[8, 1]}
            roughness={0.6}
            surface="wood"
          />
        </mesh>
      ))}
      <mesh castShadow geometry={lignin.spiral}>
        <SurfaceMaterial
          bump={0.4}
          color={FLORA_COLORS.ligninRing}
          repeat={[60, 1]}
          roughness={0.6}
          surface="wood"
        />
      </mesh>
      {Arr.map(lignin.pits, (pit) => (
        <mesh
          key={pit.id}
          position={pit.place}
          rotation={[0, Math.PI / 2 - pit.turn, 0]}
          scale={[1.5, 1, 1]}
        >
          <torusGeometry args={[0.014, 0.005, 8, 20]} />
          <SurfaceMaterial
            color={FLORA_COLORS.ligninRing}
            repeat={[2, 1]}
            roughness={0.6}
            surface="wood"
          />
        </mesh>
      ))}

      {/* The unbroken column of water with its meniscus */}
      <mesh>
        <Turn profile={waterProfile} />
        <LiquidMaterial color={BOTANY_COLORS.waterBlue} opacity={0.72} />
      </mesh>

      <Foliage
        blade={LEAF}
        deep={FLORA_COLORS.leafDeep}
        leaves={LEAVES}
        sun={FLORA_COLORS.leafSun}
        sway={0.04}
      />
      <group position={[0, CROWN + 0.07, 0.08]}>
        <mesh castShadow geometry={guards}>
          <SurfaceMaterial
            bump={0.4}
            coat={0.4}
            color={FLORA_COLORS.guardDeep}
            repeat={[1, 2]}
            roughness={0.5}
            surface="tissue"
          />
        </mesh>
        {reachesTop
          ? Arr.map(
              [
                { op: 0.2, r: 0.05, x: -0.02, y: 0.1 },
                { op: 0.16, r: 0.075, x: 0.03, y: 0.2 },
                { op: 0.11, r: 0.1, x: -0.01, y: 0.31 },
              ] as const,
              (puff) => (
                <mesh
                  key={puff.y}
                  position={[puff.x, puff.y, 0]}
                  scale={[1.1, 0.72, 0.9]}
                >
                  <icosahedronGeometry args={[puff.r, 3]} />
                  <meshBasicMaterial
                    color={BOTANY_COLORS.vaporMist}
                    depthWrite={false}
                    opacity={puff.op}
                    transparent
                  />
                </mesh>
              )
            )
          : null}
      </group>
    </group>
  );
}
