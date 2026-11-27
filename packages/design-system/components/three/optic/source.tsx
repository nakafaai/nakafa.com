import { Glow } from "@repo/design-system/components/three/optic/beam";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
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
 * show where no light arrives.
 *
 * @param color - The colour of the light
 * @param tall - How far the arrow's tip stands from the axis, signed
 * @param strength - How bright it shines, from 0 to 1
 * @param ghost - Whether no light really arrives here
 */
export function Arrow({
  color,
  ghost = false,
  strength = 1,
  tall,
}: {
  readonly color: string;
  readonly ghost?: boolean;
  readonly strength?: number;
  readonly tall: number;
}) {
  const outline = useMemo(() => arrowOutline(tall), [tall]);

  return (
    <group>
      <mesh renderOrder={6}>
        <shapeGeometry args={[outline]} />
        <meshBasicMaterial
          color={color}
          depthWrite={!ghost}
          opacity={ghost ? 0.34 : Math.min(1, 0.35 + strength)}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {ghost ? null : (
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
 * whose window carries an arrow slide, lit from behind. The arrow stands in
 * the plane of the group's origin, from the axis up to `tall`, and faces
 * along +x toward the lens.
 *
 * @param color - The colour the slide lets through
 * @param tall - How tall the arrow on the slide is
 */
export function Lamp({
  color,
  tall,
}: {
  readonly color: string;
  readonly tall: number;
}) {
  return (
    <group>
      <mesh castShadow position={[0, tall * 0.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
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
        <Arrow color={color} tall={tall} />
      </group>
    </group>
  );
}
