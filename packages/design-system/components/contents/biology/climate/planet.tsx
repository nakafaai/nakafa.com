import {
  EARTH_RADIUS,
  SUN,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  Air,
  Planet,
} from "@repo/design-system/components/three/habitat/planet";
import { Stars } from "@repo/design-system/components/three/habitat/sky";

/** How far the glow of the atmosphere reaches, past the highest molecules. */
const SHELL_RADIUS = 1.55;

/**
 * How fast the air of the model thins with height. The model's atmosphere is
 * drawn far deeper than the real one, so the molecules have room inside it.
 */
const AIR_DEPTH = 0.045;

/** How far away the stars stand, well behind the Sun and every ray. */
const STAR_DISTANCE = 40;

/**
 * The Earth under its weather, lit by the Sun of the model. It turns inside
 * the group that holds it.
 */
export function Earth() {
  return (
    <group rotation={[0.1, -1.28, 0]}>
      <Planet body="earth" radius={EARTH_RADIUS} sun={SUN.position} />
    </group>
  );
}

/**
 * The glow of the atmosphere around the Earth, which thickens a little as the
 * gas level `level` rises, against the stars of open space.
 */
export function Atmosphere({ level }: { readonly level: number }) {
  return (
    <CameraBounds exclude>
      <Air
        depth={AIR_DEPTH}
        radius={EARTH_RADIUS}
        reach={SHELL_RADIUS}
        strength={0.62 + 0.1 * level}
        sun={SUN.position}
      />
      <Stars radius={STAR_DISTANCE} />
    </CameraBounds>
  );
}
