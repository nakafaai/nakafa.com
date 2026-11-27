import { useFrame } from "@react-three/fiber";
import type { MatterSchema } from "@repo/design-system/components/three/matter/ask";
import { tendShine } from "@repo/design-system/components/three/matter/cast";
import { matterGlow } from "@repo/design-system/components/three/matter/glow";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useMemo, useRef } from "react";
import type { PointLight } from "three";

/**
 * The light a glowing part throws on what is around it. It goes inside the
 * part that glows, a mesh or a group of them, and takes the material that
 * part is made of with the same `glow`: a filament of tungsten, a coil of
 * nichrome, the epoxy lens of a lit indicator. Its colour is the colour the
 * material glows in and its power follows the same glow, so the part and
 * the pool of light under it always agree.
 *
 * It measures how much glowing surface the part has and stands in its
 * middle, so a long heater coil throws more light than a short filament at
 * the same heat and no author states a strength. The light fades with the
 * square of the distance and reaches as far as the lab does. It casts no
 * shadow, so it costs a phone the same as a desktop, and it stays in the
 * scene while the part is dark, so switching a lamp on never makes the
 * renderer rebuild its shaders.
 *
 * @param level - How much of the light a rig lets through this frame, from 0 to 1, for a lamp that warms up or a flash that fades
 * @param position - Where the light stands in the part, for a flat part whose middle lies in its own face
 */
export function Shine({
  level,
  position,
  ...ask
}: typeof MatterSchema.Type & {
  readonly level?: { readonly current: number };
  readonly position?: readonly [x: number, y: number, z: number];
}) {
  const { reach } = useStage();
  const light = useRef<PointLight>(null);
  const { cast, color } = matterGlow(ask);
  const set = position !== undefined;
  const tend = useMemo(() => tendShine(reach, set), [reach, set]);

  useFrame(() => {
    if (light.current !== null) {
      tend(light.current, cast, level?.current ?? 1);
    }
  });

  return (
    <pointLight
      color={color}
      intensity={0}
      ref={light}
      {...(position === undefined ? {} : { position })}
    />
  );
}
