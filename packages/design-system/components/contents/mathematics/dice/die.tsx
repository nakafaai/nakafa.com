import { RoundedBox } from "@react-three/drei";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  DIE,
  pipPlacements,
} from "@repo/design-system/components/contents/mathematics/dice/faces";
import { DICE_COLORS } from "@repo/design-system/lib/material/dice";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import type { Group } from "three";

/** How deep the paint in a pip stands proud of the face, so the face never flickers through it. */
const PAINT = 0.000_12;

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
 * One 16 mm resin die with rounded edges and painted pips, 1 opposite 6, 2
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
  return (
    <group ref={ref}>
      <RoundedBox
        args={[2 * DIE.half, 2 * DIE.half, 2 * DIE.half]}
        castShadow
        radius={DIE.radius}
        receiveShadow
        smoothness={5}
      >
        <meshPhysicalMaterial
          clearcoat={0.85}
          clearcoatRoughness={0.12}
          color={body}
          roughness={0.3}
        />
      </RoundedBox>
      <Instances placements={PIPS}>
        <cylinderGeometry args={[DIE.pip, DIE.pip * 0.92, 2 * PAINT, 24]} />
        <meshStandardMaterial color={pip} roughness={0.55} />
      </Instances>
    </group>
  );
}
