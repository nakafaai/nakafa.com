import { useFrame } from "@react-three/fiber";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { DoubleSide, SphereGeometry, Vector3 } from "three";

/**
 * The back half of a unit sphere, its skin lifted and sunk a little by smooth
 * noise as a living membrane is, fading to nothing at the cut so the rim
 * stays round.
 */
function useLivingHalf(seed: number) {
  const geometry = useMemo(() => {
    const half = new SphereGeometry(1, 96, 64, Math.PI, Math.PI);
    const position = half.getAttribute("position");
    const point = new Vector3();
    for (const index of Arr.range(0, position.count - 1)) {
      point.fromBufferAttribute(position, index);
      const fade = Math.min(1, Math.abs(point.z) * 6);
      const lift =
        1 +
        fade *
          (0.025 *
            (valueNoise(point.x * 5 + seed, point.y * 5 - point.z * 3, 64) -
              0.5) +
            0.01 *
              (valueNoise(point.x * 17 + seed, point.y * 17 + point.z * 9, 64) -
                0.5));
      point.multiplyScalar(lift);
      position.setXYZ(index, point.x, point.y, point.z);
    }
    half.computeVertexNormals();
    return half;
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The back half of an egg-shaped body, cut open where z is 0 so the reader
 * looks into it: an uneven, waxy skin drawn on both faces, and a rim along
 * the cut that shows how thick the skin is.
 */
export function HalfShell({
  color,
  roughness = 0.55,
  scale,
  seed = 1,
  thickness,
}: {
  readonly color: string;
  readonly roughness?: number;
  readonly scale: readonly [number, number, number];
  readonly seed?: number;
  readonly thickness: number;
}) {
  const skin = useLivingHalf(seed);
  return (
    <group scale={scale}>
      <mesh castShadow geometry={skin} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.45}
          clearcoatRoughness={0.45}
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
