import { Cells } from "@repo/design-system/components/three/flora/cells";
import {
  limbMesh,
  placeAt,
} from "@repo/design-system/components/three/flora/limb";
import { solidOf } from "@repo/design-system/components/three/flora/solid";
import {
  bendCells,
  sectionCells,
} from "@repo/design-system/components/three/flora/tissue";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BackSide,
  CatmullRomCurve3,
  DoubleSide,
  TubeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** The spun steel shade of the lamp: a collar, a flaring bell and a rolled rim. */
const SHADE_PROFILE = [
  [0.03, -0.075],
  [0.036, -0.07],
  [0.037, -0.02],
  [0.045, 0.0],
  [0.062, 0.02],
  [0.092, 0.062],
  [0.118, 0.11],
  [0.135, 0.152],
  [0.141, 0.168],
  [0.146, 0.171],
  [0.149, 0.167],
] as const;

/** The weighted foot of the lamp: a cast disc with a stepped shoulder and a boss for the arm. */
const BASE_PROFILE = [
  [0, 0],
  [0.158, 0],
  [0.166, 0.004],
  [0.168, 0.014],
  [0.164, 0.022],
  [0.15, 0.027],
  [0.09, 0.034],
  [0.05, 0.04],
  [0.034, 0.05],
  [0.03, 0.074],
  [0.024, 0.08],
  [0, 0.08],
] as const;

/** The glass of a filament bulb: a pear from its cap to its crown. */
const BULB_PROFILE = [
  [0.016, 0],
  [0.017, 0.012],
  [0.024, 0.03],
  [0.036, 0.05],
  [0.042, 0.07],
  [0.04, 0.09],
  [0.03, 0.106],
  [0.014, 0.115],
  [0, 0.117],
] as const;

/** The knurled socket the bulb screws into, above the bulb's cap. */
const SOCKET_PROFILE = [
  [0, -0.055],
  [0.02, -0.055],
  [0.022, -0.052],
  [0.022, -0.008],
  [0.02, -0.005],
  [0, -0.005],
] as const;

/** How many ribs the flexible arm of the lamp has. */
const RIBS = 110;

/** The flexible arm of the lamp: a steel hose wound in ribs, each a ridge that catches the light. */
function useGooseneck() {
  const arm = useMemo(() => {
    const spine = new CatmullRomCurve3([
      new Vector3(0, 0.07, 0),
      new Vector3(0.04, 0.34, 0),
      new Vector3(0.07, 0.66, 0),
      new Vector3(0.03, 0.94, 0),
      new Vector3(-0.07, 1.07, 0),
      new Vector3(-0.15, 1.1, 0),
    ]);
    const hose = new TubeGeometry(spine, RIBS * 4, 0.015, 12, false);
    const places = hose.getAttribute("position");
    const middle = new Vector3();
    const place = new Vector3();
    for (let index = 0; index < places.count; index += 1) {
      const ring = Math.floor(index / 13);
      spine.getPointAt(ring / (RIBS * 4), middle);
      place.fromBufferAttribute(places, index).sub(middle);
      place.multiplyScalar(1 + 0.16 * Math.sin((ring * Math.PI) / 2));
      places.setXYZ(
        index,
        middle.x + place.x,
        middle.y + place.y,
        middle.z + place.z
      );
    }
    hose.computeVertexNormals();
    return hose;
  }, []);
  useEffect(() => () => arm.dispose(), [arm]);
  return arm;
}

/** The lamp's flex: a rubber cable that leaves the foot and lies in a lazy curve on the bench. */
function useFlex() {
  const flex = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0.15, 0.012, -0.02),
          new Vector3(0.3, 0.006, -0.1),
          new Vector3(0.42, 0.006, -0.32),
          new Vector3(0.36, 0.006, -0.6),
          new Vector3(0.5, 0.006, -0.95),
          new Vector3(0.9, 0.006, -1.4),
        ]),
        60,
        0.0065,
        8,
        false
      ),
    []
  );
  useEffect(() => () => flex.dispose(), [flex]);
  return flex;
}

/**
 * A bench lamp turned on the seedling from one side: a cast foot, a ribbed
 * flexible arm, an enamelled steel shade white inside, and a lit filament
 * bulb. Its open shade faces the flank of the shoot it lights.
 */
export function DirectionalBrassLamp({
  position = [0.95, 0, 0],
}: {
  readonly position?: readonly [number, number, number];
}) {
  const arm = useGooseneck();
  const flex = useFlex();

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <Turn profile={BASE_PROFILE} />
        <SurfaceMaterial
          bump={0.5}
          coat={0.5}
          color={FLORA_COLORS.lampBase}
          repeat={[6, 2]}
          roughness={0.5}
          surface="cast"
        />
      </mesh>
      <mesh castShadow geometry={arm}>
        <SurfaceMaterial
          bump={0.3}
          color={FLORA_COLORS.lampSteel}
          metalness={1}
          repeat={[2, 40]}
          roughness={0.32}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow geometry={flex} receiveShadow>
        <SurfaceMaterial
          color={FLORA_COLORS.lampBase}
          repeat={[1, 30]}
          roughness={0.7}
          surface="rubber"
        />
      </mesh>
      <group position={[-0.2, 1.1, 0]} rotation={[0, 0, 1.98]}>
        <mesh castShadow>
          <Turn profile={SHADE_PROFILE} />
          <SurfaceMaterial
            bump={0.25}
            coat={0.8}
            color={FLORA_COLORS.lampEnamel}
            repeat={[5, 2]}
            roughness={0.4}
            surface="paint"
          />
        </mesh>
        <mesh scale={0.985}>
          <Turn profile={SHADE_PROFILE} />
          <Matter
            color={FLORA_COLORS.lampInner}
            glow={0.3}
            of="enamel"
            side={BackSide}
          />
        </mesh>
        <mesh>
          <Turn profile={SOCKET_PROFILE} />
          <SurfaceMaterial
            color={FLORA_COLORS.lampSteel}
            metalness={1}
            repeat={[8, 2]}
            roughness={0.35}
            surface="knurl"
          />
        </mesh>
        <mesh position={[0, -0.006, 0]}>
          <Turn profile={BULB_PROFILE} />
          <Matter color={FLORA_COLORS.lampGlow} glow={1} of="light" />
        </mesh>
      </group>
    </group>
  );
}

/** The cell bodies of a coleoptile are one pale green from foot to tip: it has no cap and no dividing tip left. */
const COLEOPTILE_TONES = [
  FLORA_COLORS.coleoptileCell,
  FLORA_COLORS.coleoptileCell,
  FLORA_COLORS.coleoptileLong,
  FLORA_COLORS.coleoptileCell,
] as const;

/** How thick the coleoptile is, and how far its cut cells stand out of the cut. */
const GIRTH = 0.108;
const DEPTH = 0.03;

/**
 * An oat coleoptile with its tip cut off and a block of agar holding auxin
 * set on one side of the cut, opened along its length. The back half of the
 * sheath stands behind files of real cells: under the block they grow long,
 * on the other flank they stay short, and the shoot bends away from the
 * longer side.
 *
 * @param bendRad - How far the tip has bent toward the light, in radians
 * @param skew - How much longer the cells of the shaded flank have grown, from 0 to 1
 */
export function ColeoptileCutaway({
  bendRad,
  skew,
}: {
  readonly bendRad: number;
  readonly skew: number;
}) {
  const { block, cells, sheath, top } = useMemo(() => {
    const path = Arr.makeBy(14, (step) => {
      const share = step / 13;
      const turned = bendRad * share * share;
      return [
        Math.sin(turned) * 0.52 * share,
        0.3 + share * 0.94 * Math.cos(turned * 0.55),
        0,
      ] as const;
    });
    const length = Arr.reduce(
      Arr.zipWith(Arr.drop(path, 1), path, (place, before) =>
        Math.hypot(place[0] - before[0], place[1] - before[1])
      ),
      0,
      (sum, span) => sum + span
    );
    const end = placeAt(path, path.length - 1);
    const before = placeAt(path, path.length - 2);
    const lean = Math.atan2(end[0] - before[0], end[1] - before[1]);
    return {
      block: new RoundedBoxGeometry(0.13, 0.085, 0.14, 4, 0.016),
      cells: bendCells(
        sectionCells({
          apex: 0,
          cap: 0,
          division: 0,
          elongation: 0,
          files: 6,
          length: length - 0.004,
          radius: GIRTH * 0.74,
          seed: 4,
          short: 0.05,
          skew,
          tall: 0.1,
        }),
        path
      ),
      sheath: solidOf(
        limbMesh({
          arc: 0.74,
          base: GIRTH + 0.012,
          flare: 0.12,
          furrow: 0.035,
          path,
          seed: 2,
          sides: 36,
          tip: GIRTH + 0.012,
        })
      ),
      top: { lean, x: end[0], y: end[1] },
    };
  }, [bendRad, skew]);
  useEffect(
    () => () => {
      block.dispose();
      sheath.dispose();
    },
    [block, sheath]
  );

  return (
    <group>
      <mesh castShadow geometry={sheath} receiveShadow>
        <SurfaceMaterial
          bump={0.5}
          color={FLORA_COLORS.coleoptileSkin}
          repeat={[3, 6]}
          roughness={0.5}
          side={DoubleSide}
          surface="leaf"
        />
      </mesh>
      <Cells cells={cells} depth={DEPTH} tones={COLEOPTILE_TONES} />
      <group position={[top.x, top.y, 0]} rotation={[0, 0, -top.lean]}>
        <mesh castShadow geometry={block} position={[-0.045, 0.045, 0.01]}>
          <Matter
            color={FLORA_COLORS.agarGel}
            glow={0.12}
            of="epoxy"
            opacity={0.9}
          />
        </mesh>
      </group>
    </group>
  );
}
