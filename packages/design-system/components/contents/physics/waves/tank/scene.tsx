import { waveVectors } from "@repo/design-system/components/contents/physics/waves/tank/ripple";
import { refractWave } from "@repo/design-system/components/contents/physics/waves/wave";
import { Beam } from "@repo/design-system/components/three/optic/beam";
import { Arc } from "@repo/design-system/components/three/optic/board";
import { Slab } from "@repo/design-system/components/three/optic/glass";
import {
  Dipper,
  Heading,
  TANK,
  Tray,
} from "@repo/design-system/components/three/optic/tray";
import { View } from "@repo/design-system/components/three/optic/view";
import { Water } from "@repo/design-system/components/three/optic/water";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useMemo } from "react";

/** How many deep-water wavelengths fit across the tank. */
const WAVES = 7;

/** How thick the plate that makes the near half shallow is. */
const PLATE = 0.055;

/** How long each drawn ray is, and the radius of an angle's arc. */
const RAY = 1.45;
const ARC = 0.55;

/** Wall seconds a crest takes to move one wavelength, whatever the real frequency. */
const PERIOD_SECONDS = 1.1;

const DEGREE = Math.PI / 180;

/** The side the tank is read from: from above its near wall, close to a plan of the crests. */
const FROM = [0, 6, 2.3] as const;

/** What the view holds: the water from wall to wall, and the dipper over it. */
const FRAME = {
  x: { max: TANK.wide / 2 + TANK.wall, min: -TANK.wide / 2 - TANK.wall },
  y: { max: TANK.level + 0.2, min: TANK.level - 0.1 },
  z: { max: TANK.deep / 2 + TANK.wall, min: -TANK.deep / 2 - TANK.wall },
} as const;

/**
 * A ripple tank on its legs, with a glass plate under the near half that
 * makes the water there shallow. The dipper sends straight crests across
 * the step: the water's surface is the wave itself on both sides, so the
 * crests close up to the shorter wavelength and turn toward the normal
 * where they slow down. Over the water lie the ray along the direction of
 * travel on each side, the normal, and the two angles. The view looks down
 * on the water from wall to wall, so the crests and the angles in both
 * depths fill the frame.
 */
export function TankScene({
  deep,
  incidence,
  shallow,
  wavelength,
}: {
  /** The wave speed in the deep water, in centimetres per second. */
  readonly deep: number;
  /** The angle of incidence, in degrees. */
  readonly incidence: number;
  /** The wave speed in the shallow water, in centimetres per second. */
  readonly shallow: number;
  /** The wavelength in the deep water, in centimetres. */
  readonly wavelength: number;
}) {
  const wave = { incidence, speed: deep, wavelength };
  const unit = TANK.deep / (WAVES * wavelength);
  const vectors = useMemo(
    () => waveVectors({ incidence, speed: deep, wavelength }, shallow, unit),
    [deep, incidence, shallow, unit, wavelength]
  );
  const turn = incidence * DEGREE;
  const bend = refractWave(wave, shallow).refraction * DEGREE;

  return (
    <View box={FRAME} from={FROM}>
      <Tray />
      <group position={[0, TANK.legs + TANK.floor, TANK.deep / 4]}>
        <Slab
          deep={TANK.deep / 2 - 0.02}
          tall={PLATE}
          wide={TANK.wide - 0.04}
        />
      </group>
      <group position={[0, TANK.level, 0]}>
        <Water
          deep={TANK.deep}
          period={PERIOD_SECONDS}
          vectors={vectors}
          wide={TANK.wide}
        />
      </group>
      <Dipper incidence={incidence} />
      <group position={[0, TANK.level + 0.03, 0]}>
        <Beam
          color={INSTRUMENT_COLORS.paper}
          dashed
          points={[
            [0, 0, -RAY],
            [0, 0, RAY],
          ]}
          strength={0.9}
          width={0.008}
        />
        <Heading
          angle={-Math.PI / 2 + turn}
          color={PLOT_COLORS.amber}
          from={[-Math.sin(turn) * RAY, -Math.cos(turn) * RAY]}
          long={RAY}
        />
        <Heading
          angle={-Math.PI / 2 + bend}
          color={PLOT_COLORS.pink}
          from={[0, 0]}
          long={RAY}
        />
        <Arc
          color={PLOT_COLORS.amber}
          from={Math.PI / 2}
          radius={ARC}
          to={Math.PI / 2 + turn}
        />
        <Arc
          color={PLOT_COLORS.pink}
          from={-Math.PI / 2}
          radius={ARC}
          to={-Math.PI / 2 + bend}
        />
      </group>
    </View>
  );
}
