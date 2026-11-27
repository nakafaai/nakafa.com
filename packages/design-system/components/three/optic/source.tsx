import { Glow } from "@repo/design-system/components/three/optic/beam";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Shape, Vector2, Vector3 } from "three";

/** The outline of a ray box seen from above: a long case with rounded corners, its slit end at x = 0. */
function caseOutline(long: number, wide: number) {
  const outline = new Shape();
  const round = 0.035;
  const half = wide / 2;
  outline.moveTo(-long + round, -half);
  outline.lineTo(-round, -half);
  outline.quadraticCurveTo(0, -half, 0, -half + round);
  outline.lineTo(0, half - round);
  outline.quadraticCurveTo(0, half, -round, half);
  outline.lineTo(-long + round, half);
  outline.quadraticCurveTo(-long, half, -long, half - round);
  outline.lineTo(-long, -half + round);
  outline.quadraticCurveTo(-long, -half, -long + round, -half);
  return outline;
}

/** The mains flex of a ray box, sagging from its back down onto the bench and away. */
function flexCurve(long: number, tall: number) {
  return new CatmullRomCurve3([
    new Vector3(-long - 0.02, tall * 0.45, 0),
    new Vector3(-long - 0.16, tall * 0.4, 0.01),
    new Vector3(-long - 0.3, 0.05, 0.06),
    new Vector3(-long - 0.55, 0.014, 0.2),
    new Vector3(-long - 0.9, 0.014, 0.52),
    new Vector3(-long - 1.5, 0.014, 0.7),
  ]);
}

/**
 * A ray box lying on the bench: a black crackle-painted lamp house with
 * cooling fins across its top, a slotted holder at its front with a metal
 * slit plate in it, and its flex trailing away behind. Its slit is at the
 * origin of its group, `rise` above the bench, and the narrow beam leaves
 * along +x. `color` is the light it gives, which glows in the slit.
 *
 * @param color - The colour of its light
 * @param rise - How high above the bench its slit and its beam are
 */
export function RayBox({
  color,
  rise,
}: {
  readonly color: string;
  readonly rise: number;
}) {
  const long = 0.62;
  const wide = 0.34;
  const tall = rise * 2;
  const outline = useMemo(() => caseOutline(long, wide), []);
  const flex = useMemo(() => flexCurve(long, tall), [tall]);

  return (
    <group position={[0, -rise, 0]}>
      <mesh
        castShadow
        position={[-0.03, 0.012, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <extrudeGeometry
          args={[
            outline,
            {
              bevelEnabled: true,
              bevelSegments: 3,
              bevelSize: 0.012,
              bevelThickness: 0.012,
              curveSegments: 10,
              depth: tall - 0.024,
            },
          ]}
        />
        <SurfaceMaterial
          bump={0.9}
          color={INSTRUMENT_COLORS.graphite}
          repeat={[3, 3]}
          roughness={0.62}
          surface="cast"
        />
      </mesh>
      {Arr.map(Arr.range(0, 6), (fin) => (
        <mesh
          castShadow
          key={fin}
          position={[-0.16 - fin * 0.062, tall + 0.014, 0]}
        >
          <boxGeometry args={[0.02, 0.03, wide - 0.07]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.anodised}
            metalness={1}
            repeat={[1, 2]}
            roughness={0.44}
            surface="brushed"
          />
        </mesh>
      ))}
      <mesh castShadow position={[-0.012, tall / 2, 0]}>
        <boxGeometry args={[0.012, tall + 0.03, wide - 0.05]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.aluminium}
          metalness={1}
          repeat={[1, 2]}
          roughness={0.34}
          surface="brushed"
        />
      </mesh>
      <mesh position={[-0.005, rise, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.014, tall * 0.62]} />
        <meshBasicMaterial color={color} side={DoubleSide} toneMapped={false} />
      </mesh>
      <group position={[-0.002, rise, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Glow color={color} size={0.2} strength={0.8} />
      </group>
      <mesh castShadow position={[-long - 0.03, tall * 0.45, 0]}>
        <cylinderGeometry args={[0.026, 0.03, 0.05, 20]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.graphite}
          roughness={0.85}
          surface="rubber"
        />
      </mesh>
      <mesh castShadow rotation={[0, 0, 0]}>
        <tubeGeometry args={[flex, 48, 0.014, 10]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.graphite}
          repeat={[1, 30]}
          roughness={0.8}
          surface="rubber"
        />
      </mesh>
    </group>
  );
}

/** How solid the arrow of a virtual image is drawn. */
const GHOST = 0.5;

/** The outline of an arrow from the origin up to `tall`, as wide as a lamp's slide shows it. */
function arrowOutline(tall: number) {
  const outline = new Shape();
  const reach = Math.abs(tall);
  const side = Math.sign(tall);
  const shaft = reach * 0.045;
  const head = reach * 0.17;
  const neck = reach * 0.7;
  outline.moveTo(-shaft, 0);
  outline.lineTo(shaft, 0);
  outline.lineTo(shaft, side * neck);
  outline.lineTo(head, side * neck);
  outline.lineTo(0, side * reach);
  outline.lineTo(-head, side * neck);
  outline.lineTo(-shaft, side * neck);
  outline.closePath();
  return outline;
}

/**
 * A lit arrow in the plane of its group, from the axis up to `tall`, or
 * down when `tall` is negative: the object slide of a lamp, the real image
 * it throws on a screen, or, as a `ghost`, the virtual image a lens seems to
 * show where no light arrives. As a `mark` it is the arrow of a ray diagram
 * instead: flat ink that stays in sight in front of the apparatus it marks.
 *
 * @param color - The colour of the light
 * @param tall - How far the arrow's tip stands from the axis, signed
 * @param strength - How bright it shines, from 0 to 1
 * @param ghost - Whether no light really arrives here
 * @param mark - Whether it marks a place in a diagram rather than lighting a surface
 */
export function Arrow({
  color,
  ghost = false,
  mark = false,
  strength = 1,
  tall,
}: {
  readonly color: string;
  readonly ghost?: boolean;
  readonly mark?: boolean;
  readonly strength?: number;
  readonly tall: number;
}) {
  const outline = useMemo(() => arrowOutline(tall), [tall]);

  return (
    <group>
      <mesh renderOrder={mark ? 12 : 6}>
        <shapeGeometry args={[outline]} />
        <meshBasicMaterial
          color={color}
          depthTest={!mark}
          depthWrite={!(ghost || mark)}
          opacity={ghost ? GHOST : Math.min(1, 0.35 + strength)}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {ghost || mark ? null : (
        <group position={[0, tall * 0.55, 0.002]}>
          <Glow
            color={color}
            size={Math.abs(tall) * 2.6}
            strength={0.35 * strength}
          />
        </group>
      )}
    </group>
  );
}

/** The turned outline of a lamp house: a drum with a stepped vent cap and a bezel round its window. */
const LAMP_PROFILE = Arr.map(
  [
    [0.0004, -0.2],
    [0.07, -0.2],
    [0.074, -0.19],
    [0.074, -0.17],
    [0.1, -0.16],
    [0.104, -0.15],
    [0.104, -0.012],
    [0.112, -0.008],
    [0.112, 0.008],
    [0.098, 0.012],
    [0.098, 0.004],
    [0.0004, 0.004],
  ] as const,
  ([radius, along]) => new Vector2(radius, along)
);

/**
 * An illuminated object for an optical bench: a lamp house on the axis
 * whose window carries a slide, lit from behind. The slide is the lamp's
 * children, such as an `Arrow`: it stands in the plane of the group's
 * origin, from the axis up to `tall`, and faces along +x toward the lens.
 *
 * @param tall - How tall the slide in the window is
 */
export function Lamp({
  children,
  tall,
}: {
  readonly children: ReactNode;
  readonly tall: number;
}) {
  return (
    <group>
      <mesh
        castShadow
        position={[0, tall * 0.5, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <latheGeometry args={[LAMP_PROFILE, 64]} />
        <SurfaceMaterial
          bump={0.8}
          color={INSTRUMENT_COLORS.graphite}
          repeat={[6, 2]}
          roughness={0.6}
          surface="cast"
        />
      </mesh>
      <mesh position={[-0.21, tall * 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 20]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[-0.08, tall * 0.5 - 0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 20]} />
        <MetalMaterial color={INSTRUMENT_COLORS.silver} roughness={0.24} />
      </mesh>
      <group position={[0.006, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        {children}
      </group>
    </group>
  );
}

/** How long a laser's housing is, and how far below its axis its clamp reaches, which a carrier's post takes. */
const LASER_LONG = 0.62;
export const LASER_DROP = 0.13;

/** The turned outline of a laser's housing, its aperture at the origin and its body behind it. */
const LASER_PROFILE = Arr.map(
  [
    [0.0004, -0.012],
    [0.016, -0.012],
    [0.016, 0],
    [0.046, 0],
    [0.05, -0.004],
    [0.05, -0.05],
    [0.058, -0.054],
    [0.058, -LASER_LONG + 0.03],
    [0.052, -LASER_LONG + 0.024],
    [0.052, -LASER_LONG + 0.006],
    [0.046, -LASER_LONG],
    [0.0004, -LASER_LONG],
  ] as const,
  ([radius, along]) => new Vector2(radius, along)
);

/** The lead of a laser, sagging from its back down toward the bench and away. */
function leadCurve() {
  return new CatmullRomCurve3([
    new Vector3(-LASER_LONG, 0, 0),
    new Vector3(-LASER_LONG - 0.1, -0.01, 0),
    new Vector3(-LASER_LONG - 0.2, -0.16, 0.03),
    new Vector3(-LASER_LONG - 0.24, -0.5, 0.1),
    new Vector3(-LASER_LONG - 0.26, -0.9, 0.2),
  ]);
}

/**
 * A laser on the optical axis: a black anodised tube with a knurled focus
 * ring at its front and a split clamp round its middle, its lead trailing
 * from its back. Its aperture is at the origin of its group and its beam
 * leaves along +x, in its `color`, which glows in the aperture.
 *
 * @param color - The colour of its light
 */
export function Laser({ color }: { readonly color: string }) {
  const lead = useMemo(leadCurve, []);

  return (
    <group>
      <mesh castShadow rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[LASER_PROFILE, 64]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.anodised}
          metalness={1}
          repeat={[10, 2]}
          roughness={0.4}
          surface="brushed"
        />
      </mesh>
      <mesh castShadow position={[-0.027, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.053, 0.053, 0.04, 48]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.aluminium}
          metalness={1}
          repeat={[14, 1]}
          roughness={0.28}
          surface="knurl"
        />
      </mesh>
      <group position={[-LASER_LONG / 2, 0, 0]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.066, 0.066, 0.07, 48]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[8, 1]}
            roughness={0.34}
            surface="brushed"
          />
        </mesh>
        <mesh castShadow position={[0, -0.095, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.07, 24]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[2, 1]}
            roughness={0.34}
            surface="brushed"
          />
        </mesh>
        <mesh
          castShadow
          position={[0, 0.02, 0.07]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.014, 0.014, 0.03, 20]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[5, 1]}
            roughness={0.28}
            surface="knurl"
          />
        </mesh>
      </group>
      <mesh position={[0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.012, 24]} />
        <meshBasicMaterial color={color} side={DoubleSide} toneMapped={false} />
      </mesh>
      <group position={[0.003, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Glow color={color} size={0.16} strength={0.9} />
      </group>
      <mesh castShadow>
        <tubeGeometry args={[lead, 40, 0.011, 10]} />
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.graphite}
          repeat={[1, 24]}
          roughness={0.8}
          surface="rubber"
        />
      </mesh>
    </group>
  );
}
