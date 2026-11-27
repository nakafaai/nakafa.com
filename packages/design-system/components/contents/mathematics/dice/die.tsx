import { RoundedBox } from "@react-three/drei";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  DIE,
  pipPlacements,
} from "@repo/design-system/components/contents/mathematics/dice/faces";
import { DICE_COLORS } from "@repo/design-system/lib/material/dice";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { BufferGeometry, Float32BufferAttribute } from "three";

/** How far a pip's dish stands proud of the face, so the face never flickers through it. */
const PAINT = 0.000_06;

/** How many rings and spokes shape the dish of one pip. */
const DISH = { rings: 8, spokes: 32 } as const;

/** How steeply the wall of a drilled pip falls from its rim, as a slope. */
const DISH_SLOPE = 1.5;

/**
 * A drilled pip: a flat disc whose normals are those of the round-bottomed
 * dish a drill leaves, so the light shades it as a recess with a bright far
 * wall and a dark near one, without cutting the die's body. It lies in the
 * plane y = `PAINT`, facing +y, `DIE.pip` in radius.
 */
function dishGeometry() {
  const rim = Arr.flatMap(Arr.range(1, DISH.rings), (ring) => {
    const share = ring / DISH.rings;
    const slope = DISH_SLOPE * share;
    const length = Math.hypot(slope, 1);
    return Arr.map(Arr.range(0, DISH.spokes - 1), (spoke) => {
      const angle = (2 * Math.PI * spoke) / DISH.spokes;
      const across = Math.cos(angle);
      const along = Math.sin(angle);
      return {
        normal: [
          (-slope * across) / length,
          1 / length,
          (-slope * along) / length,
        ],
        position: [DIE.pip * share * across, PAINT, DIE.pip * share * along],
      };
    });
  });
  const positions = [0, PAINT, 0, ...Arr.flatMap(rim, (each) => each.position)];
  const normals = [0, 1, 0, ...Arr.flatMap(rim, (each) => each.normal)];
  const indices = Arr.flatMap(Arr.range(0, DISH.spokes - 1), (spoke) => {
    const next = (spoke + 1) % DISH.spokes;
    return [
      0,
      1 + next,
      1 + spoke,
      ...Arr.flatMap(Arr.range(1, DISH.rings - 1), (ring) => {
        const inner = 1 + (ring - 1) * DISH.spokes;
        const outer = inner + DISH.spokes;
        return [
          inner + spoke,
          inner + next,
          outer + next,
          inner + spoke,
          outer + next,
          outer + spoke,
        ];
      }),
    ];
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Every pip of a die, placed once: each looks out along its face. */
const PIPS = Arr.map(pipPlacements(), (pip) => ({
  position: pip.position,
  up: pip.normal,
}));

/** The two resins a pair of dice is cast in, each with the paint of its pips. */
const FINISHES = {
  ivory: { body: DICE_COLORS.ivory, pip: DICE_COLORS.ivoryPip },
  onyx: { body: DICE_COLORS.onyx, pip: DICE_COLORS.onyxPip },
};

/**
 * One 16 mm cast resin die with polished rounded edges and drilled, painted pips, 1 opposite 6, 2
 * opposite 5 and 3 opposite 4. The scene moves it by its `ref`, so a frame
 * that turns it never re-renders it.
 */
export function Die({
  finish,
  ref,
}: {
  readonly finish: keyof typeof FINISHES;
  readonly ref: Ref<Group>;
}) {
  const { body, pip } = FINISHES[finish];
  const dish = useMemo(dishGeometry, []);
  useEffect(() => () => dish.dispose(), [dish]);
  return (
    <group ref={ref}>
      <RoundedBox
        args={[2 * DIE.half, 2 * DIE.half, 2 * DIE.half]}
        castShadow
        radius={DIE.radius}
        receiveShadow
        smoothness={10}
      >
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.06}
          color={body}
          ior={1.56}
          roughness={0.22}
        />
      </RoundedBox>
      <Instances placements={PIPS}>
        <primitive attach="geometry" object={dish} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          color={pip}
          polygonOffset
          polygonOffsetFactor={-2}
          roughness={0.4}
        />
      </Instances>
    </group>
  );
}
