import { usePostprocessingDegraded } from "@repo/design-system/components/three/guard";
import type { MatterSchema } from "@repo/design-system/components/three/matter/ask";
import {
  fitMaps,
  freeMaps,
  layMaps,
} from "@repo/design-system/components/three/matter/maps";
import { matterLook } from "@repo/design-system/components/three/matter/recipe";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { RELIEF } from "@repo/design-system/components/three/surface/material";
import type { Ref } from "react";
import { useEffect, useMemo } from "react";
import type { MeshPhysicalMaterial, Side } from "three";

/**
 * The material of a real thing, by name: brass, oak, borosilicate glass,
 * stove enamel in a colour, a dyed liquid. The name brings the measured
 * colour, the relief of its surface, its roughness, metalness, clear coat
 * and wear, so a part never reads as a flat, untextured shape. A metal takes
 * the `finish` it was worked to; what is painted, dyed or moulded takes its
 * `color`; a metal that `glow`s is hot and radiates the colour of its heat,
 * and anything else that glows is lit in its own colour. Clear glass with a
 * `thickness` bends the scene behind it where the device can spare a second
 * render of the scene, and stays plain clear glass on a phone. A clear pane
 * mirrors the room in full where the stage has its photographic finish, and
 * is faded as a whole where the stage draws straight to the screen.
 *
 * The material measures the part it is put on and lays its detail at the
 * detail's size in the lab it stands in, so a large case and a small screw
 * of one material carry the same grain, and the grain of wood runs along
 * the length of whatever is cut from it. A rig that changes the glow on
 * every frame holds the material by `ref`.
 *
 * @param attach - Where the material attaches, for a mesh with one material per group
 * @param ref - The material itself, for a rig that drives it every frame
 * @param side - Which faces draw, where a thin sheet is seen from both sides
 */
export function Matter({
  attach = "material",
  ref,
  side,
  ...ask
}: typeof MatterSchema.Type & {
  readonly attach?: string;
  readonly ref?: Ref<MeshPhysicalMaterial>;
  readonly side?: Side;
}) {
  const { profile, reach, tier } = useStage();
  const degraded = usePostprocessingDegraded();
  const { grain, relief, surface, tile, ...look } = matterLook(
    tier === "full" ? ask : { ...ask, thickness: 0 },
    degraded || !profile.postprocessing
  );
  const maps = useMemo(() => layMaps(surface), [surface]);
  const fitted = useMemo(
    () => ({ ...maps[0], onBeforeRender: fitMaps(maps, tile * reach, grain) }),
    [grain, maps, reach, tile]
  );

  useEffect(() => () => freeMaps(maps), [maps]);

  return (
    <meshPhysicalMaterial
      attach={attach}
      normalScale={[relief * RELIEF, relief * RELIEF]}
      {...look}
      {...fitted}
      {...(ref === undefined ? {} : { ref })}
      side={side ?? look.side}
    />
  );
}
