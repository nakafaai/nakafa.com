import { useFrame } from "@react-three/fiber";
import {
  flagellumPath,
  rodProfile,
  rodSurfaceSpots,
  surfaceBump,
} from "@repo/design-system/components/contents/biology/bacteria/cell";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  CatmullRomCurve3,
  type Group,
  type InstancedMesh,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

/** A point in a bacterium's own frame, in micrometres. */
type Point = readonly [number, number, number];

/** How fast a flagellar motor turns its filament while the card plays, in radians a second. */
const MOTOR_SPEED = 6;

/**
 * The surface of a rod-shaped cell `length` long with poles of `radius`, its
 * long axis along x, bumped a little by noise as a living envelope is, so no
 * two cells look turned on a lathe.
 */
export function useRodGeometry(radius: number, length: number, seed: number) {
  const geometry = useMemo(() => {
    const profile = Arr.map(
      rodProfile(radius, length, 18),
      ([r, x]) => new Vector2(r, x)
    );
    const lathe = new LatheGeometry(profile, 64);
    const position = lathe.getAttribute("position");
    const point = new Vector3();
    for (const index of Arr.range(0, position.count - 1)) {
      point.fromBufferAttribute(position, index);
      const ring = Math.hypot(point.x, point.z);
      if (ring > 1e-6) {
        const lift =
          1 + surfaceBump(Math.atan2(point.z, point.x), point.y, seed);
        point.x *= lift;
        point.z *= lift;
      }
      position.setXYZ(index, point.x, point.y, point.z);
    }
    lathe.rotateZ(-Math.PI / 2);
    lathe.computeVertexNormals();
    return lathe;
  }, [length, radius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The slime capsule some bacteria wear: a soft, nearly clear halo of
 * polysaccharide around the wall.
 */
export function CapsuleHalo({
  geometry,
  scale,
}: {
  readonly geometry: BufferGeometry;
  readonly scale: readonly [number, number, number];
}) {
  return (
    <mesh geometry={geometry} scale={scale}>
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.1}
        color={MATERIAL.bacterialCapsule}
        depthWrite={false}
        opacity={0.16}
        roughness={0.15}
        transparent
      />
    </mesh>
  );
}

/**
 * Fimbriae: many short, straight protein hairs standing out from the whole
 * surface, drawn as one instanced mesh.
 */
export function Fimbriae({
  count,
  length,
  radius,
  reach,
}: {
  readonly count: number;
  readonly length: number;
  readonly radius: number;
  readonly reach: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const spots = useMemo(
    () => rodSurfaceSpots(count, radius, length),
    [count, length, radius]
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const up = new Vector3(0, 1, 0);
    const turn = new Quaternion();
    const matrix = new Matrix4();
    const scale = new Vector3();
    Arr.forEach(spots, ({ normal, position }, index) => {
      const direction = new Vector3(...normal);
      const hair = reach * (0.7 + 0.6 * ((index * 0.618) % 1));
      turn.setFromUnitVectors(up, direction);
      scale.set(1, hair, 1);
      const middle = new Vector3(...position).addScaledVector(
        direction,
        hair / 2
      );
      target.setMatrixAt(index, matrix.compose(middle, turn, scale));
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh args={[undefined, undefined, count]} ref={mesh}>
      <cylinderGeometry args={[0.0045, 0.0055, 1, 5]} />
      <meshStandardMaterial color={MATERIAL.fimbria} roughness={0.6} />
    </instancedMesh>
  );
}

/**
 * One flagellum: a hook at `origin` on the surface and a left-handed helical
 * filament trailing behind the cell along `direction`. While the card plays,
 * the motor turns it about its own axis.
 */
export function Flagellum({
  direction,
  length,
  origin,
  phase,
}: {
  readonly direction: Point;
  readonly length: number;
  readonly origin: Point;
  readonly phase: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const spin = useRef<Group>(null);
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(
          flagellumPath({
            length,
            phase,
            pitch: 0.95,
            radius: 0.11,
            samples: 160,
          }),
          (point) => new Vector3(...point)
        )
      ),
    [length, phase]
  );
  const turn = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(1, 0, 0),
        new Vector3(...direction).normalize()
      ),
    [direction]
  );
  useFrame((state, delta) => {
    if (playing && spin.current !== null) {
      spin.current.rotation.x += delta * MOTOR_SPEED;
      state.invalidate();
    }
  });
  return (
    <group position={origin} quaternion={turn}>
      <group ref={spin}>
        <mesh castShadow>
          <tubeGeometry args={[curve, 220, 0.011, 6, false]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={MATERIAL.flagellin}
            roughness={0.4}
          />
        </mesh>
      </group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.02, 0.008, 6, 14]} />
        <meshStandardMaterial color={MATERIAL.flagellin} roughness={0.5} />
      </mesh>
    </group>
  );
}
