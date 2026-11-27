import { RoundedBox } from "@react-three/drei";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

type Point = readonly [number, number, number];

/** Where an instrument's four rubber feet stand, as shares of its half size. */
const FEET = [
  [-0.8, -0.8],
  [0.8, -0.8],
  [-0.8, 0.8],
  [0.8, 0.8],
] as const;

/** The height of an instrument's feet, which lift its case off the bench. */
const FOOT = 0.03;

/**
 * A bench instrument's case standing on the bench at the origin: a painted
 * steel shell with rounded edges on four rubber feet. Its controls and
 * screen are drawn as children, in the case's own frame.
 *
 * @param size - The case's width, height and depth
 */
function Case({
  children,
  size,
}: {
  readonly children: ReactNode;
  readonly size: Point;
}) {
  const [width, height, depth] = size;
  return (
    <group position={[0, FOOT + height / 2, 0]}>
      <RoundedBox
        args={[width, height, depth]}
        castShadow
        radius={0.025}
        receiveShadow
        smoothness={4}
      >
        <SurfaceMaterial
          color={QUANTUM_COLORS.furnaceSteel}
          repeat={[2, 2]}
          roughness={0.55}
          surface="paint"
        />
      </RoundedBox>
      {Arr.map(FEET, ([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          position={[(x * width) / 2, -height / 2 - FOOT / 2, (z * depth) / 2]}
        >
          <cylinderGeometry args={[0.03, 0.026, FOOT, 16]} />
          <SurfaceMaterial color={QUANTUM_COLORS.rubberRing} surface="rubber" />
        </mesh>
      ))}
      {children}
    </group>
  );
}

/** A 4 mm binding post on a front panel, facing +z. */
function Post({
  color,
  position,
}: {
  readonly color: string;
  readonly position: Point;
}) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.026, 0.03, 0.05, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.02, 12]} />
        <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * A bench function generator facing +z: a dark front panel with a knurled
 * frequency dial and its red and black output posts.
 *
 * @param knob - The dial's turn in radians
 */
export function Generator({ knob }: { readonly knob: number }) {
  return (
    <Case size={[0.52, 0.34, 0.5]}>
      <mesh position={[0, 0, 0.251]}>
        <planeGeometry args={[0.46, 0.28]} />
        <meshStandardMaterial color={QUANTUM_COLORS.crtBezel} roughness={0.6} />
      </mesh>
      <group position={[-0.09, 0.01, 0.27]} rotation={[0, 0, knob]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.082, 0.04, 40]} />
          <SurfaceMaterial
            color={QUANTUM_COLORS.aluminium}
            metalness={1}
            repeat={[6, 1]}
            roughness={0.35}
            surface="brushed"
          />
        </mesh>
        <mesh position={[0, 0.05, 0.021]}>
          <boxGeometry args={[0.01, 0.04, 0.004]} />
          <meshBasicMaterial color={QUANTUM_COLORS.acWave} />
        </mesh>
      </group>
      <Post color={QUANTUM_COLORS.bananaRed} position={[0.13, 0.05, 0.27]} />
      <Post color={QUANTUM_COLORS.bananaBlack} position={[0.13, -0.06, 0.27]} />
    </Case>
  );
}

/**
 * A bench oscilloscope whose screen is on its -x face: a bezel, the dark
 * phosphor screen with the live trace given as children, and a column of
 * control knobs beside it.
 */
export function Scope({ children }: { readonly children: ReactNode }) {
  return (
    <Case size={[0.5, 0.44, 0.62]}>
      <mesh position={[-0.251, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.56, 0.38]} />
        <meshStandardMaterial color={QUANTUM_COLORS.crtBezel} roughness={0.6} />
      </mesh>
      <mesh position={[-0.253, 0.02, -0.07]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.36, 0.28]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.screenGlow}
          emissive={QUANTUM_COLORS.crtGrid}
          emissiveIntensity={0.5}
          roughness={0.15}
        />
      </mesh>
      {Arr.map([0.1, 0, -0.1] as const, (y) => (
        <mesh
          castShadow
          key={y}
          position={[-0.265, y + 0.02, 0.2]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.028, 0.03, 0.03, 24]} />
          <SurfaceMaterial
            color={QUANTUM_COLORS.aluminium}
            metalness={1}
            repeat={[4, 1]}
            roughness={0.35}
            surface="brushed"
          />
        </mesh>
      ))}
      <group position={[-0.258, 0.02, -0.07]}>{children}</group>
    </Case>
  );
}

function createLead(from: Point, to: Point) {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  // The lead leaves its post, droops onto the bench and climbs to its terminal.
  const rest = start.clone().lerp(end, 0.5).setY(0.02);
  const out = start
    .clone()
    .lerp(rest, 0.35)
    .setY(Math.max(from[1] * 0.6, 0.05));
  const back = end
    .clone()
    .lerp(rest, 0.35)
    .setY(Math.max(to[1] * 0.6, 0.05));
  return new TubeGeometry(
    new CatmullRomCurve3([start, out, rest, back, end]),
    48,
    0.011,
    10,
    false
  );
}

/**
 * A silicone test lead between two points, lying slack on the bench between
 * them.
 */
export function Lead({
  color,
  from,
  to,
}: {
  readonly color: string;
  readonly from: Point;
  readonly to: Point;
}) {
  const lead = useMemo(() => createLead(from, to), [from, to]);
  useEffect(() => () => lead.dispose(), [lead]);

  return (
    <mesh castShadow geometry={lead}>
      <SurfaceMaterial
        color={color}
        repeat={[1, 8]}
        roughness={0.6}
        surface="rubber"
      />
    </mesh>
  );
}

/** A screw terminal soldered to the board, where a lead lands. */
export function Terminal({ position }: { readonly position: Point }) {
  return (
    <mesh castShadow position={position}>
      <cylinderGeometry args={[0.022, 0.026, 0.05, 16]} />
      <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
    </mesh>
  );
}
