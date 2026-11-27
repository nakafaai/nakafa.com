import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";

/** The gun's proportions in scene units, measured from its trunnions. */
export const CANNON = {
  /** The radius of the shot, a little under the bore so it loads freely. */
  ball: 0.082,
  /** The radius of the bore. */
  bore: 0.09,
  /** How far the muzzle's face lies ahead of the trunnions. */
  muzzle: 0.64,
  /** The height of the trunnions above the ground the carriage stands on. */
  trunnion: 0.34,
} as const;

/**
 * The barrel's outline from the cascabel's button to the muzzle's face and
 * back down the bore: base ring, two reinforces stepped by astragal rings,
 * the tapering chase and the muzzle swell, as a cast gun is turned.
 */
const BARREL_OUTLINE = [
  [0, -0.41],
  [0.04, -0.405],
  [0.058, -0.375],
  [0.05, -0.345],
  [0.032, -0.328],
  [0.05, -0.31],
  [0.158, -0.3],
  [0.168, -0.285],
  [0.168, -0.262],
  [0.152, -0.255],
  [0.15, -0.03],
  [0.16, -0.025],
  [0.16, 0],
  [0.142, 0.008],
  [0.134, 0.24],
  [0.143, 0.245],
  [0.143, 0.268],
  [0.126, 0.276],
  [0.108, 0.54],
  [0.126, 0.575],
  [0.138, 0.605],
  [0.132, 0.632],
  [0.108, CANNON.muzzle],
  [CANNON.bore, CANNON.muzzle],
  [CANNON.bore, 0.2],
  [0, 0.2],
] as const;

/**
 * One cheek of the carriage seen from its side: tall under the trunnions and
 * stepped down toward the rear, as a garrison carriage's brackets are cut.
 */
const CHEEK_OUTLINE = [
  [0.27, 0.07],
  [0.27, 0.33],
  [0.06, 0.33],
  [0.045, 0.3],
  [-0.045, 0.3],
  [-0.06, 0.33],
  [-0.14, 0.33],
  [-0.14, 0.26],
  [-0.3, 0.26],
  [-0.3, 0.19],
  [-0.45, 0.19],
  [-0.45, 0.12],
  [-0.58, 0.12],
  [-0.58, 0.07],
] as const;

/** Where the carriage's four trucks stand: [along the gun, radius]. */
const TRUCKS = [
  [0.14, 0.105],
  [-0.44, 0.09],
] as const;

/** Half the carriage's width, to the middle of a cheek. */
const HALF = 0.215;

function createBarrel() {
  const barrel = new LatheGeometry(
    Arr.map(BARREL_OUTLINE, ([radius, along]) => new Vector2(radius, along)),
    48
  );
  // The lathe turns about y; the gun's bore runs along x.
  barrel.rotateZ(-Math.PI / 2);
  return barrel;
}

function createCheek() {
  const [first, ...rest] = CHEEK_OUTLINE;
  const outline = new Shape();
  outline.moveTo(first[0], first[1]);
  for (const [x, y] of rest) {
    outline.lineTo(x, y);
  }
  outline.closePath();
  const cheek = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelOffset: -0.006,
    bevelSegments: 2,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    depth: 0.05,
  });
  cheek.translate(0, 0, -0.025);
  return cheek;
}

/** Weathered gun bronze: a dull metal the sea air has browned. */
function Bronze() {
  return (
    <SurfaceMaterial
      bump={0.35}
      color={MACHINE_COLORS.gunBronze}
      metalness={0.9}
      repeat={[3, 2]}
      roughness={0.55}
      surface="brushed"
    />
  );
}

/** Black wrought iron, hammered rather than polished. */
function Iron() {
  return (
    <meshStandardMaterial
      color={MACHINE_COLORS.castIron}
      metalness={0.85}
      roughness={0.55}
    />
  );
}

/** The carriage's oiled oak. */
function Oak({ repeat }: { readonly repeat: readonly [number, number] }) {
  return (
    <SurfaceMaterial
      color={MACHINE_COLORS.walnut}
      repeat={repeat}
      roughness={0.8}
      surface="wood"
    />
  );
}

/** One truck: a solid oak wheel with an iron tyre and a hub pin. */
function Truck({
  along,
  radius,
  side,
}: {
  readonly along: number;
  readonly radius: number;
  readonly side: number;
}) {
  return (
    <group
      position={[along, radius, side * 0.3]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.94, radius * 0.94, 0.07, 32]} />
        <Oak repeat={[1, 1]} />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, 0.05, 32, 1, true]} />
        <Iron />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.022, 0.022, 0.1, 12]} />
        <Iron />
      </mesh>
    </group>
  );
}

/**
 * A bronze smooth-bore gun on an oak garrison carriage, standing on the
 * ground at the origin with its trunnions over it and its muzzle toward +x.
 * The barrel turns on its trunnions to `elevation`, so its bore lies along
 * the shot's first direction.
 *
 * @param elevation - The barrel's angle above the horizon in radians
 */
export function Cannon({ elevation }: { readonly elevation: number }) {
  const barrel = useMemo(createBarrel, []);
  const cheek = useMemo(createCheek, []);
  useEffect(
    () => () => {
      barrel.dispose();
      cheek.dispose();
    },
    [barrel, cheek]
  );

  return (
    <group>
      <group position={[0, CANNON.trunnion, 0]} rotation={[0, 0, elevation]}>
        <mesh castShadow geometry={barrel} receiveShadow>
          <Bronze />
        </mesh>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.042, HALF * 2 + 0.07, 24]} />
          <Bronze />
        </mesh>
        {/* The dark of the bore, which the shot leaves through. */}
        <mesh position={[0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[CANNON.bore, CANNON.bore, 0.2, 24]} />
          <meshBasicMaterial color={MACHINE_COLORS.castIron} />
        </mesh>
      </group>

      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <mesh
            castShadow
            geometry={cheek}
            position={[0, 0, side * HALF]}
            receiveShadow
          >
            <Oak repeat={[2, 1]} />
          </mesh>
          {/* The capsquare: the iron strap that holds a trunnion in its seat. */}
          <mesh castShadow position={[0, 0.342, side * HALF]}>
            <boxGeometry args={[0.2, 0.014, 0.056]} />
            <Iron />
          </mesh>
          {Arr.map(TRUCKS, ([along, radius]) => (
            <Truck along={along} key={along} radius={radius} side={side} />
          ))}
        </group>
      ))}

      {Arr.map(TRUCKS, ([along, radius]) => (
        <mesh castShadow key={along} position={[along, radius, 0]}>
          <boxGeometry args={[0.1, 0.075, 0.54]} />
          <Oak repeat={[2, 1]} />
        </mesh>
      ))}
      {/* The transom that ties the cheeks together under the chase. */}
      <mesh castShadow position={[0.225, 0.2, 0]}>
        <boxGeometry args={[0.05, 0.16, HALF * 2 - 0.05]} />
        <Oak repeat={[1, 1]} />
      </mesh>
    </group>
  );
}

/** A cast-iron round shot at the origin, optionally faded to mark a past position. */
export function Shot({ faded = false }: { readonly faded?: boolean }) {
  return (
    <mesh castShadow={!faded}>
      <sphereGeometry args={[CANNON.ball, 32, 24]} />
      <meshStandardMaterial
        color={MACHINE_COLORS.castIron}
        depthWrite={!faded}
        metalness={0.7}
        opacity={faded ? 0.42 : 1}
        roughness={0.5}
        transparent={faded}
      />
    </mesh>
  );
}
