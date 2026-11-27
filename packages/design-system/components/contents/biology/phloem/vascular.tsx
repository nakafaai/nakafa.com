import type { RingMode } from "@repo/design-system/components/contents/biology/phloem/model";
import { chanceAt } from "@repo/design-system/components/three/field/noise";
import type { Blade } from "@repo/design-system/components/three/flora/blade";
import { Blobs } from "@repo/design-system/components/three/flora/blobs";
import { Foliage } from "@repo/design-system/components/three/flora/foliage";
import {
  joinMeshes,
  limbMesh,
  smoothPath,
} from "@repo/design-system/components/three/flora/limb";
import { solidOf } from "@repo/design-system/components/three/flora/solid";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  Path,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

/** How wide a sieve tube is, and where the xylem vessel stands beside it. */
const TUBE = 0.14;
const VESSEL = -0.42;

/** The source leaf at the top of the stem: broad, toothed and veined. */
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

/** Where the source leaf is, as the numbers that place one leaf. */
const LEAVES = [0.02, 1.24, 0, 0.9, 0.38, 0.22, -0.36, 0.92, -0.1, 0.6, 0.5];

/** The companion cells, one beside each sieve-tube element: dense, narrow and alive. */
const COMPANIONS = [
  ...[0.24, 0.97, 0.02, 0.15, 0.44, 0.15, 0.4],
  ...[0.24, 0.47, 0.02, 0.15, 0.46, 0.15, 0.7],
];

/** The nucleus of each companion cell; a sieve tube has none and lives on its neighbour's. */
const NUCLEI = [
  ...[0.25, 1.0, 0.07, 0.075, 0.1, 0.075, 0.3],
  ...[0.25, 0.5, 0.07, 0.075, 0.1, 0.075, 0.6],
];

/** A straight upright axis from `from` to `to` at `x`, laid out in enough places to carry relief. */
function upright(x: number, from: number, to: number) {
  return Arr.makeBy(
    10,
    (step) => [x, from + ((to - from) * step) / 9, 0] as const
  );
}

/** A sieve plate: the end wall between two sieve-tube elements, pierced by real pores the sap runs through. */
function useSievePlate() {
  const plate = useMemo(() => {
    const wall = new Shape().absarc(0, 0, TUBE + 0.006, 0, Math.PI * 2);
    wall.holes = Arr.map(Arr.range(0, 18), (pore) => {
      const far = pore === 0 ? 0 : 0.045 + 0.045 * Math.floor((pore + 5) / 12);
      const turn = (pore / (pore < 7 ? 6 : 12)) * Math.PI * 2;
      return new Path().absarc(
        Math.cos(turn) * far,
        Math.sin(turn) * far,
        0.0125,
        0,
        Math.PI * 2,
        true
      );
    });
    return new ExtrudeGeometry(wall, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      curveSegments: 20,
      depth: 0.022,
    })
      .rotateX(-Math.PI / 2)
      .translate(0, -0.011, 0);
  }, []);
  useEffect(() => () => plate.dispose(), [plate]);
  return plate;
}

/** The stem cut open along its length, its xylem vessel and the strands that join companion cell to sieve tube. */
function useStem() {
  const stem = useMemo(() => {
    const spiral = new CatmullRomCurve3(
      Arr.makeBy(133, (step) => {
        const turn = (step / 12) * 2 * Math.PI;
        return new Vector3(
          VESSEL + Math.cos(turn) * 0.09,
          0.16 + (1.06 * step) / 132,
          Math.sin(turn) * 0.09
        );
      })
    );
    const element = (from: number, to: number) =>
      solidOf(
        limbMesh({
          arc: 0.72,
          base: TUBE,
          flare: 0,
          furrow: 0.02,
          path: upright(0, from, to),
          seed: 3,
          sides: 40,
          tip: TUBE,
        })
      );
    return {
      bare: solidOf(
        limbMesh({
          arc: 1,
          base: 0.1,
          flare: 0,
          furrow: 0.03,
          path: upright(0, 0.2, 0.5),
          seed: 8,
          sides: 28,
          tip: 0.1,
        })
      ),
      bark: solidOf(
        limbMesh({
          arc: 0.5,
          base: 0.64,
          flare: 0.06,
          furrow: 0.1,
          path: upright(-0.04, 0.12, 1.24),
          seed: 6,
          sides: 64,
          tip: 0.62,
        })
      ),
      bridges: solidOf(
        joinMeshes(
          Arr.makeBy(8, (bridge) => {
            const y = (bridge < 4 ? 0.84 : 0.34) + (bridge % 4) * 0.08;
            return limbMesh({
              arc: 1,
              base: 0.008,
              flare: 0,
              furrow: 0,
              path: smoothPath(
                [
                  [TUBE - 0.01, y, 0.03],
                  [0.16, y + 0.01 * (chanceAt(bridge, 1, 2) - 0.5), 0.035],
                  [0.19, y, 0.03],
                ],
                6
              ),
              seed: bridge,
              sides: 6,
              tip: 0.008,
            });
          })
        )
      ),
      lower: element(0.22, 0.71),
      roots: solidOf(
        joinMeshes(
          Arr.makeBy(9, (root) => {
            const turn = (root / 9) * 2 * Math.PI + chanceAt(root, 1, 4);
            const reach = 0.18 + 0.16 * chanceAt(root, 2, 4);
            return limbMesh({
              arc: 1,
              base: 0.014,
              flare: 0.4,
              furrow: 0.1,
              path: smoothPath(
                [
                  [Math.cos(turn) * 0.1, 0.1, Math.sin(turn) * 0.07],
                  [
                    Math.cos(turn) * (0.1 + reach * 0.5),
                    0.05,
                    Math.sin(turn) * (0.07 + reach * 0.5),
                  ],
                  [
                    Math.cos(turn + 0.3) * (0.1 + reach),
                    0.012,
                    Math.sin(turn + 0.3) * (0.07 + reach),
                  ],
                ],
                10
              ),
              seed: root,
              sides: 6,
              tip: 0.003,
            });
          })
        )
      ),
      spiral: new TubeGeometry(spiral, 330, 0.011, 8, false),
      upper: element(0.73, 1.2),
      vessel: solidOf(
        limbMesh({
          arc: 1,
          base: 0.085,
          flare: 0,
          furrow: 0,
          path: upright(VESSEL, 0.15, 1.23),
          seed: 2,
          sides: 28,
          tip: 0.085,
        })
      ),
    };
  }, []);
  useEffect(
    () => () => {
      Arr.forEach(
        [
          stem.bare,
          stem.bark,
          stem.bridges,
          stem.lower,
          stem.roots,
          stem.spiral,
          stem.upper,
          stem.vessel,
        ],
        (solid) => solid.dispose()
      );
    },
    [stem]
  );
  return stem;
}

/** The living, sap-filled wall of a sieve-tube element, seen through from the cut. */
function TubeSkin() {
  return (
    <meshPhysicalMaterial
      clearcoat={0.6}
      clearcoatRoughness={0.2}
      color={FLORA_COLORS.phloemPale}
      opacity={0.8}
      roughness={0.3}
      side={DoubleSide}
      transparent
    />
  );
}

/**
 * A stem cut open along its length to show how sugar travels: a sieve tube
 * of two elements joined end to end through a sieve plate of real pores,
 * the companion cell that keeps each element alive, the xylem vessel beside
 * them, the leaf that loads the sugar and the storage organ that takes it.
 * With the bark ringed, the lower element is gone and bare wood shows, and
 * the element above the ring swells with the sap it can no longer pass on.
 *
 * @param bulgeScale - How far the element above the ring has swollen
 * @param mode - Whether the bark is intact or ringed
 */
export function PhloemVascularBundle({
  bulgeScale,
  mode,
}: {
  readonly bulgeScale: number;
  readonly mode: RingMode;
}) {
  const stem = useStem();
  const plate = useSievePlate();
  const intact = mode === "intact";

  return (
    <group>
      <mesh castShadow geometry={stem.bark} receiveShadow>
        <SurfaceMaterial
          bump={1}
          color={FLORA_COLORS.barkGrey}
          repeat={[4, 1]}
          roughness={0.95}
          side={DoubleSide}
          surface="bark"
        />
      </mesh>

      {/* The xylem vessel beside the phloem: water in a tube braced by a spiral of lignin */}
      <mesh geometry={stem.vessel}>
        <meshPhysicalMaterial
          clearcoat={0.85}
          color={BOTANY_COLORS.waterBlue}
          opacity={0.5}
          roughness={0.14}
          transparent
        />
      </mesh>
      <mesh castShadow geometry={stem.spiral}>
        <SurfaceMaterial
          bump={0.4}
          color={FLORA_COLORS.ligninRing}
          repeat={[80, 1]}
          roughness={0.6}
          surface="wood"
        />
      </mesh>

      {/* The sieve-tube element above the plate, which swells when the bark is ringed */}
      <mesh
        castShadow
        geometry={stem.upper}
        scale={[bulgeScale, 1, bulgeScale]}
      >
        <TubeSkin />
      </mesh>
      <mesh castShadow geometry={plate} position={[0, 0.72, 0]}>
        <SurfaceMaterial
          bump={0.3}
          coat={0.3}
          color={BOTANY_COLORS.sievePlate}
          repeat={[2, 2]}
          roughness={0.5}
          surface="tissue"
        />
      </mesh>

      {/* Below the plate: the next element, or bare wood where the bark was ringed */}
      {intact ? (
        <group>
          <mesh castShadow geometry={stem.lower}>
            <TubeSkin />
          </mesh>
          <mesh castShadow geometry={plate} position={[0, 0.21, 0]}>
            <SurfaceMaterial
              bump={0.3}
              coat={0.3}
              color={BOTANY_COLORS.sievePlate}
              repeat={[2, 2]}
              roughness={0.5}
              surface="tissue"
            />
          </mesh>
        </group>
      ) : (
        <mesh castShadow geometry={stem.bare}>
          <SurfaceMaterial
            bump={0.6}
            color={FLORA_COLORS.woodEarly}
            repeat={[2, 3]}
            roughness={0.75}
            surface="wood"
          />
        </mesh>
      )}

      {/* Companion cells, their nuclei and the strands that join them to the sieve tube */}
      <Blobs
        blobs={intact ? COMPANIONS : Arr.take(COMPANIONS, 7)}
        deep={FLORA_COLORS.phloemDeep}
        gloss={0.6}
        shape="pill"
        sun={FLORA_COLORS.phloemPale}
      />
      <Blobs
        blobs={intact ? NUCLEI : Arr.take(NUCLEI, 7)}
        deep={FLORA_COLORS.nucleusStain}
        gloss={0.7}
        shape="ball"
        sun={FLORA_COLORS.nucleusStain}
      />
      <mesh geometry={stem.bridges}>
        <meshPhysicalMaterial
          color={BOTANY_COLORS.sucroseGold}
          roughness={0.35}
        />
      </mesh>

      <Foliage
        blade={LEAF}
        deep={FLORA_COLORS.leafDeep}
        leaves={LEAVES}
        sun={FLORA_COLORS.leafSun}
        sway={0.04}
      />

      {/* The sink: a storage organ and its roots */}
      <mesh
        castShadow
        position={[0, 0.1, 0]}
        receiveShadow
        rotation={[0.1, 0, 0.3]}
        scale={[1.5, 0.74, 0.95]}
      >
        <icosahedronGeometry args={[0.12, 5]} />
        <SurfaceMaterial
          bump={0.9}
          color={FLORA_COLORS.rootSkin}
          repeat={[3, 2]}
          roughness={0.85}
          surface="concrete"
        />
      </mesh>
      <mesh castShadow geometry={stem.roots}>
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={FLORA_COLORS.rootHair}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}
