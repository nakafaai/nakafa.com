import { useFrame } from "@react-three/fiber";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { DoubleSide, type Group, type InstancedMesh, Object3D } from "three";

/**
 * The back half of an egg-shaped body, cut open where z is 0 so the reader
 * looks into it: a skin drawn on both faces, and a rim along the cut that
 * shows how thick the skin is.
 */
export function HalfShell({
  color,
  roughness = 0.55,
  scale,
  thickness,
}: {
  readonly color: string;
  readonly roughness?: number;
  readonly scale: readonly [number, number, number];
  readonly thickness: number;
}) {
  return (
    <group scale={scale}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 72, 48, Math.PI, Math.PI]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.5}
          color={color}
          roughness={roughness}
          side={DoubleSide}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[1 - thickness / 2, thickness / 2, 12, 96]} />
        <meshStandardMaterial color={color} roughness={roughness + 0.1} />
      </mesh>
    </group>
  );
}

/**
 * Many copies of one small body, such as ribosomes or mitochondria, each at
 * its own spot, turned and stretched as `place` gives it, in one draw call.
 */
export function Scatter({
  children,
  count,
  place,
}: {
  readonly children: ReactNode;
  readonly count: number;
  readonly place: (
    index: number
  ) => readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const holder = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) {
      return;
    }
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      const [position, rotation, scale] = place(index);
      holder.position.set(position[0], position[1], position[2]);
      holder.rotation.set(rotation[0], rotation[1], rotation[2]);
      holder.scale.set(scale[0], scale[1], scale[2]);
      holder.updateMatrix();
      instanced.setMatrixAt(index, holder.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [count, holder, place]);

  return (
    <instancedMesh args={[undefined, undefined, count]} castShadow ref={mesh}>
      {children}
    </instancedMesh>
  );
}

/**
 * Turns its children slowly back and forth about the vertical while
 * `playing`, so the reader sees the cut cell from both sides, and drifts the
 * cytoplasm's contents a little as streaming moves them.
 */
export function Sway({
  children,
  playing,
}: {
  readonly children: ReactNode;
  readonly playing: boolean;
}) {
  const group = useRef<Group>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (!(playing && group.current)) {
      return;
    }
    clock.current += Math.min(delta, 0.1);
    group.current.rotation.y = Math.sin(clock.current * 0.5) * 0.45;
  });

  return <group ref={group}>{children}</group>;
}

/**
 * The ink of a label written into a scene: dark on the light theme and light
 * on the dark one. A label given no outline draws its halo in the card's own
 * colour, so the pair reads on both themes.
 */
export function useLabelInk() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  return getThemeAppearance(resolvedTheme) === "dark"
    ? ORIGIN_COLOR.LIGHT
    : ORIGIN_COLOR.DARK;
}
