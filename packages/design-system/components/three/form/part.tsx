import { grainOf } from "@repo/design-system/components/three/form/detail";
import { claim, hold } from "@repo/design-system/components/three/form/store";
import type { Shape } from "@repo/design-system/components/three/form/sweep";
import {
  SweepSchema,
  sweepShape,
} from "@repo/design-system/components/three/form/sweep";
import {
  TurnSchema,
  turnShape,
} from "@repo/design-system/components/three/form/turn";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Schema } from "effect";
import { useEffect } from "react";

const sweepKey = Schema.encodeSync(Schema.fromJsonString(SweepSchema));
const turnKey = Schema.encodeSync(Schema.fromJsonString(TurnSchema));

/**
 * The shared geometry of one shape at the stage's grain, held while the part
 * that asks for it is shown and freed when the last such part goes away.
 */
function useForm(key: string, build: (grain: number) => Shape) {
  const { reach, tier } = useStage();
  const grain = grainOf(tier, reach);
  const id = `${grain}:${key}`;
  const geometry = claim(id, () => build(grain));
  useEffect(() => hold(id, geometry), [geometry, id]);
  return geometry;
}

/**
 * The geometry of a part swept along a path, as a child of its mesh: a wire,
 * a lead, a hose, a pipe, a coil or a strip. The author names the path and
 * the section; the sampling, the frames, the caps, the texture coordinates,
 * the segment counts for the device and the geometry's lifetime are the
 * engine's.
 *
 * @example
 * <mesh castShadow>
 *   <Sweep path={FEED} radius={0.011} />
 *   <MetalMaterial color={steel} />
 * </mesh>
 */
export function Sweep(sweep: typeof SweepSchema.Type) {
  const geometry = useForm(`sweep:${sweepKey(sweep)}`, (grain) =>
    sweepShape(sweep, grain)
  );
  return <primitive attach="geometry" object={geometry} />;
}

/**
 * The geometry of a part turned about the vertical axis, as a child of its
 * mesh: a beaker, a flask, a dome, a flange or a droplet. The author draws
 * the outline, and names a wall for glass; the rounding, the lip and base,
 * the spout, the texture coordinates, the segment counts for the device and
 * the geometry's lifetime are the engine's.
 *
 * @example
 * <mesh castShadow>
 *   <Turn profile={BEAKER} spout wall={0.002} />
 *   <GlassMaterial color={glass} />
 * </mesh>
 */
export function Turn(turn: typeof TurnSchema.Type) {
  const geometry = useForm(`turn:${turnKey(turn)}`, (grain) =>
    turnShape(turn, grain)
  );
  return <primitive attach="geometry" object={geometry} />;
}
