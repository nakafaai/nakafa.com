import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

/** How many faces go round a turned part: smooth at any zoom the lab allows. */
const AROUND = 72;

/**
 * A part turned on a lathe from a profile of rings, each a radius and a
 * height in metres, about the upright axis.
 */
export function Turned({
  rings,
}: {
  readonly rings: readonly (readonly [number, number])[];
}) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(rings, ([radius, height]) => new Vector2(radius, height)),
        AROUND
      ),
    [rings]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}

/**
 * The pale grey stove enamel on the microscope's cast foot, limb and head,
 * with the faint orange peel a sprayed and baked coat keeps.
 */
export function Enamel({
  repeat,
}: {
  readonly repeat: readonly [number, number];
}) {
  return (
    <SurfaceMaterial
      bump={0.55}
      coat={0.4}
      color={BIOLOGY_COLORS.microscopeCast}
      repeat={repeat}
      roughness={0.5}
      surface="paint"
    />
  );
}

/** Bright chromed steel and brass: objectives, the nosepiece, clips and screws. */
export function Chrome({
  repeat = [3, 1],
}: {
  readonly repeat?: readonly [number, number];
}) {
  return (
    <SurfaceMaterial
      bump={0.3}
      color={BIOLOGY_COLORS.microscopeChrome}
      metalness={1}
      repeat={repeat}
      roughness={0.16}
      surface="brushed"
    />
  );
}

/** The black anodised and painted metal of the stage, tubes and knobs. */
export function Blackened({
  repeat = [4, 4],
}: {
  readonly repeat?: readonly [number, number];
}) {
  return (
    <SurfaceMaterial
      bump={0.35}
      color={BIOLOGY_COLORS.microscopeBlack}
      metalness={0.4}
      repeat={repeat}
      roughness={0.5}
      surface="cast"
    />
  );
}

/**
 * The cut grip around a knob or a ring that fingers turn: a diamond knurl
 * `around` cuts round and `along` cuts across, in bright or blackened metal.
 */
export function Grip({
  along,
  around,
  bright = false,
}: {
  readonly along: number;
  readonly around: number;
  readonly bright?: boolean;
}) {
  return (
    <SurfaceMaterial
      bump={1}
      color={
        bright
          ? BIOLOGY_COLORS.microscopeChrome
          : BIOLOGY_COLORS.microscopeBlack
      }
      metalness={bright ? 1 : 0.5}
      repeat={[around, along]}
      roughness={bright ? 0.24 : 0.46}
      surface="knurl"
    />
  );
}
