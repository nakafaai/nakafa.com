import { RESPIROMETER_COLORS } from "@repo/design-system/lib/material/respirometer";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide, LatheGeometry, Vector2 } from "three";

/** A lathe outline: radius and height pairs in metres, turned about the vertical. */
export type Outline = readonly (readonly [number, number])[];

/** `steps` points along a circular arc about (`x`, `y`), from angle `from` to `to` in radians. */
export function arc(
  x: number,
  y: number,
  radius: number,
  from: number,
  to: number,
  steps: number
): Outline {
  return Arr.map(Arr.range(0, steps), (step) => {
    const angle = from + ((to - from) * step) / steps;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
}

/** The refractive index of borosilicate 3.3 laboratory glass (Schott Duran, n_d). */
const BOROSILICATE_IOR = 1.473;

/**
 * Clear borosilicate glass drawn without a second render of the scene: a
 * dark tint, so a wall the reader looks straight through adds almost no
 * light of its own, under a glossy clear coat whose reflections brighten
 * the edges, where real glass turns to a mirror.
 */
export function ClearGlass({ opacity }: { readonly opacity: number }) {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.03}
      color={RESPIROMETER_COLORS.glassTint}
      depthWrite={false}
      envMapIntensity={2.4}
      ior={BOROSILICATE_IOR}
      opacity={opacity}
      roughness={0.04}
      side={DoubleSide}
      transparent
    />
  );
}

/**
 * A clear liquid drawn as glass is: a faint `color` over what lies behind
 * it and a wet clear-coat sheen on its surface.
 */
export function ClearLiquid({
  color,
  opacity,
}: {
  readonly color: string;
  readonly opacity: number;
}) {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.06}
      color={color}
      depthWrite={false}
      envMapIntensity={1.6}
      ior={1.333}
      opacity={opacity}
      roughness={0.08}
      transparent
    />
  );
}

/** Turns `outline` about the vertical into a geometry, disposed of with the component. */
export function useLathe(outline: Outline, segments: number) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(outline, ([radius, height]) => new Vector2(radius, height)),
        segments
      ),
    [outline, segments]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A 25 × 150 mm borosilicate boiling tube, in metres: its outer radius, its
 * wall, and its length.
 */
export const BOILING_TUBE = {
  length: 0.15,
  radius: 0.0125,
  wall: 0.0012,
} as const;

/** The boiling tube's inner radius, in metres. */
export const TUBE_BORE = BOILING_TUBE.radius - BOILING_TUBE.wall;

/**
 * The boiling tube's wall, turned from its foot: a round bottom, a straight
 * wall, and a fire-polished lip, the inside followed back down to the foot.
 */
const TUBE_OUTLINE: Outline = [
  ...arc(0, BOILING_TUBE.radius, BOILING_TUBE.radius, -Math.PI / 2, 0, 12),
  ...arc(
    BOILING_TUBE.radius - BOILING_TUBE.wall / 2,
    BOILING_TUBE.length - BOILING_TUBE.wall / 2,
    BOILING_TUBE.wall / 2,
    0,
    Math.PI,
    6
  ),
  ...arc(0, BOILING_TUBE.radius, TUBE_BORE, 0, -Math.PI / 2, 12),
];

/** A boiling tube standing on its round foot at the origin. */
export function BoilingTube() {
  const wall = useLathe(TUBE_OUTLINE, 40);
  return (
    <mesh geometry={wall}>
      <ClearGlass opacity={0.24} />
    </mesh>
  );
}

/**
 * The clear solution in the foot of a boiling tube, potassium hydroxide
 * solution or water, standing `depth` above the inside of its round bottom,
 * with the concave meniscus a wetting liquid draws up the glass by `rise`.
 */
export function TubeLiquid({
  depth,
  rise,
}: {
  readonly depth: number;
  readonly rise: number;
}) {
  const outline = useMemo(() => {
    const inner = TUBE_BORE - 0.0001;
    const foot = BOILING_TUBE.wall;
    const level = foot + depth;
    const wall = arc(0, BOILING_TUBE.radius, inner, -Math.PI / 2, 0, 12);
    const top = Arr.map(Arr.range(0, 10), (step) => {
      const share = 1 - step / 10;
      return [inner * share, level + rise * share ** 4] as const;
    });
    return [...wall, ...top];
  }, [depth, rise]);
  const geometry = useLathe(outline, 40);
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <ClearLiquid color={RESPIROMETER_COLORS.solution} opacity={0.34} />
    </mesh>
  );
}

/**
 * The capillary tubing, in metres: 6 mm across outside (Eisco CH0748B) with
 * a 1 mm bore (Pearson Edexcel Biology B Core Practical 9), the bore drawn
 * at the width it shows through the round wall, which magnifies an object at
 * its centre by the glass's refractive index of about 1.5 (OpenStax
 * University Physics Volume 3, 2.3 Images Formed by Refraction), and the
 * radius its bend is drawn round.
 */
export const CAPILLARY = {
  bend: 0.009,
  bore: 0.000_75,
  radius: 0.003,
} as const;
