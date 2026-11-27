import { Backdrop } from "@repo/design-system/components/three/stage/backdrop";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { Motes } from "@repo/design-system/components/three/stage/motes";
import { toneColor } from "@repo/design-system/components/three/stage/place";
import { Field } from "@repo/design-system/components/three/stage/scope";
import {
  SETTING_SUNS,
  Softboxes,
  Sun,
  useDark,
} from "@repo/design-system/components/three/stage/settings";
import { getColor } from "@repo/design-system/lib/color";

/** How much of a backdrop's own light shows on a dark page. */
const DARK_DIM = 0.42;

/** Where the depth of a medium starts and finishes swallowing what floats in it, in reaches. */
const DEPTH_NEAR = 2.2;
const DEPTH_FAR = 13;

/** The tone open water takes at the depth where things fade into it. */
const WATER_DEPTH = {
  dark: toneColor([6, 36, 50]),
  light: toneColor([47, 142, 166]),
} as const;

/** The tone the inside of a cell takes at the depth where things fade into it. */
const CELL_DEPTH = {
  dark: toneColor([42, 29, 58]),
  light: toneColor([169, 131, 159]),
} as const;

/**
 * Open water, or the watery inside of a cell, at the scale of a molecule:
 * blue-green depth that darkens below and brightens toward the light above,
 * slow shafts and the rippling net of light that falls through a surface,
 * solutes and fine grains adrift in Brownian motion, sharp in the plane of
 * the subject and blurred before and behind it. Nothing stands on anything
 * here, so the place has no floor.
 */
export function WaterSetting() {
  const dark = useDark();
  const { reach } = useStage();
  const depth = dark ? WATER_DEPTH.dark : WATER_DEPTH.light;

  return (
    <>
      <color args={[depth]} attach="background" />
      <Backdrop
        body={toneColor([11, 74, 94])}
        crowd={0.22}
        dim={dark ? DARK_DIM : 1}
        glow={toneColor([201, 246, 255])}
        grain={2.4}
        high={toneColor([127, 208, 223])}
        low={toneColor([10, 58, 82])}
        ripple={0.3}
        shafts={0.22}
      />
      <fog args={[depth, DEPTH_NEAR * reach, DEPTH_FAR * reach]} attach="fog" />
      <Softboxes ambient={0.45} exposure={0.85} hemisphere={0.8} />
      <hemisphereLight
        args={[toneColor([191, 239, 255]), toneColor([13, 71, 96]), 0.9]}
      />
      <Sun direction={SETTING_SUNS.water} intensity={1.7} />
      <Motes
        blur={2.2}
        drift={0.05}
        from={toneColor([230, 251, 255])}
        hollow={0.25}
        opacity={0.5}
        pace={0.5}
        seed={11}
        size={0.012}
        spread={3.2}
        to={toneColor([159, 224, 234])}
      />
      <Motes
        blur={3}
        drift={0.09}
        from={toneColor([217, 247, 255])}
        hollow={0.45}
        opacity={0.16}
        pace={0.22}
        seed={13}
        share={0.06}
        size={0.11}
        spread={3.6}
        to={toneColor([124, 201, 216])}
      />
    </>
  );
}

/**
 * The inside of a cell or of its nucleus: no open water but a crowd.
 * Translucent bodies pack the distance out of focus, pale pockets of light
 * lie between them, and granules the size of ribosomes jitter everywhere,
 * sharp only in the plane of the subject. The place has no floor.
 */
export function CellSetting() {
  const dark = useDark();
  const { reach } = useStage();
  const depth = dark ? CELL_DEPTH.dark : CELL_DEPTH.light;

  return (
    <>
      <color args={[depth]} attach="background" />
      <Backdrop
        body={toneColor([91, 63, 120])}
        crowd={0.62}
        dim={dark ? DARK_DIM : 1}
        glow={toneColor([255, 225, 207])}
        grain={4.4}
        high={toneColor([227, 185, 196])}
        low={toneColor([109, 79, 134])}
        ripple={0.06}
        shafts={0.08}
      />
      <fog args={[depth, DEPTH_NEAR * reach, DEPTH_FAR * reach]} attach="fog" />
      <Softboxes ambient={0.5} exposure={0.9} hemisphere={0.8} />
      <hemisphereLight
        args={[toneColor([255, 233, 224]), toneColor([90, 63, 119]), 0.8]}
      />
      <Sun direction={SETTING_SUNS.cell} intensity={1.5} />
      <Motes
        blur={2.4}
        drift={0.03}
        from={toneColor([255, 241, 230])}
        hollow={0.3}
        opacity={0.55}
        pace={1.1}
        seed={23}
        size={0.014}
        spread={3}
        to={toneColor([215, 179, 230])}
      />
      <Motes
        blur={3}
        drift={0.06}
        from={toneColor([244, 211, 220])}
        hollow={0.5}
        opacity={0.2}
        pace={0.3}
        seed={29}
        share={0.1}
        size={0.16}
        spread={3.8}
        to={toneColor([141, 107, 176])}
      />
    </>
  );
}

/**
 * The view down a light microscope, for a lab that studies a specimen: the
 * round field lit from below through the slide, the black field stop around
 * it, and the even white light of the lamp on the specimen. The place has
 * no floor: the specimen lies in the field.
 */
export function MicroscopeSetting() {
  const dark = useDark();

  return (
    <>
      <color args={[getColor("BLACK")]} attach="background" />
      <Field
        core={toneColor([251, 247, 236])}
        dim={dark ? 0.62 : 1}
        rim={toneColor([230, 217, 189])}
      />
      <Softboxes ambient={0.6} exposure={1.05} hemisphere={0.9} />
      <hemisphereLight
        args={[toneColor([255, 250, 240]), toneColor([233, 220, 192]), 0.7]}
      />
      <Sun direction={SETTING_SUNS.microscope} intensity={1.2} />
    </>
  );
}
