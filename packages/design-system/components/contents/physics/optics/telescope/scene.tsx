import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  starRay,
  telescope,
} from "@repo/design-system/components/contents/physics/optics/ray";
import { Beam, Glow } from "@repo/design-system/components/three/optic/beam";
import {
  Backboard,
  Rail,
  Rider,
} from "@repo/design-system/components/three/optic/bench";
import { Lens } from "@repo/design-system/components/three/optic/glass";
import {
  CROWN_INDEX,
  cellDrop,
} from "@repo/design-system/components/three/optic/lens";
import { View } from "@repo/design-system/components/three/optic/view";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** How high above the benchtop the optical axis runs. */
const AXIS = 1.05;

/** How long the bench is, and how far from its left end the objective stands. */
const LENGTH = 7;
const LEAD = 1.5;

/** The slope at which light from the distant star reaches the objective: it comes down at 1.2 degrees. */
const TILT = -Math.tan((1.2 * Math.PI) / 180);

/** The heights, as shares of the radius of the objective, of the three rays drawn from the star. */
const RAY_HEIGHTS = [0.8, 0, -0.8] as const;

/** Half the width of the objective and of the eyepiece, in scene units. */
const RADIUS = 0.55;
const EYE = 0.135;

/** How far in front of the objective the rays from the star are drawn. */
const APPROACH = 0.9;

/** The side the bench is read from: straight on, from a little above the axis. */
const FROM = [0, 0.5, 6] as const;

/**
 * An astronomical telescope in normal adjustment, built the way a class
 * builds one: a weak objective and a strong eyepiece on an optical bench,
 * the sum of their focal lengths apart. Three parallel rays from a distant
 * star enter the objective, cross where it forms the image of the star in
 * the focal plane both lenses share, and leave the eyepiece parallel again
 * at a steeper angle. The view holds the bench from where the rays arrive to
 * where they leave, so the telescope fills the frame at any length.
 */
export function TelescopeScene({
  eyepiece,
  labels,
  longest,
  objective,
}: {
  /** The power of the eyepiece, in dioptres. */
  readonly eyepiece: number;
  readonly labels: {
    readonly eyepiece: ReactNode;
    readonly objective: ReactNode;
  };
  /** The longest the telescope gets over the range of eyepieces, in centimetres. */
  readonly longest: number;
  /** The power of the objective, in dioptres. */
  readonly objective: number;
}) {
  const scope = telescope(objective, eyepiece);
  const unit = (LENGTH - LEAD - 1.1) / longest;
  const start = -LENGTH / 2 + LEAD;
  const end = start + scope.length * unit;
  const radius = RADIUS;
  const lenses = {
    eyepiece: scope.eyepiece * unit,
    objective: scope.objective * unit,
  };
  const front = {
    focal: lenses.objective,
    half: radius,
    index: CROWN_INDEX,
    thin: 0.03,
  };
  const back = {
    focal: lenses.eyepiece,
    half: EYE,
    index: CROWN_INDEX,
    thin: 0.02,
  };
  const leave = Math.min(lenses.eyepiece * 6, 1.3);
  const focus = start + lenses.objective;

  return (
    <View
      box={{
        x: { max: end + leave + 0.12, min: start - APPROACH - 0.12 },
        y: { max: AXIS + radius + 0.42, min: -0.06 },
        z: { max: 0.36, min: -0.3 },
      }}
      from={FROM}
    >
      <SeamlessBenchSurface />
      <Backboard back={0.8} tall={2.1} wide={LENGTH + 0.7} />
      <Rail length={LENGTH} unit={unit} />
      <Rider at={start} drop={cellDrop(front)} height={AXIS}>
        <Lens focal={front.focal} half={front.half} thin={front.thin} />
      </Rider>
      <Rider at={end} drop={cellDrop(back)} height={AXIS}>
        <Lens focal={back.focal} half={back.half} thin={back.thin} />
      </Rider>
      <Tag position={[start, AXIS + radius + 0.2, 0]}>{labels.objective}</Tag>
      <Tag position={[end, AXIS + radius + 0.2, 0]}>{labels.eyepiece}</Tag>
      {Arr.map(RAY_HEIGHTS, (share) => {
        const height = share * radius;
        const ray = starRay(height, TILT, lenses);
        return (
          <Beam
            color={INSTRUMENT_COLORS.lampLight}
            key={share}
            points={[
              [start - APPROACH, AXIS + height - TILT * APPROACH, 0],
              [start, AXIS + height, 0],
              [end, AXIS + ray.atEyepiece, 0],
              [end + leave, AXIS + ray.atEyepiece + ray.out * leave, 0],
            ]}
            strength={0.8}
            width={0.009}
          />
        );
      })}
      <Beam
        color={PLOT_COLORS.amber}
        dashed
        points={[
          [focus, AXIS - radius * 1.1, 0],
          [focus, AXIS + radius * 1.1, 0],
        ]}
        strength={0.9}
        width={0.007}
      />
      <group position={[focus, AXIS + lenses.objective * TILT, 0.02]}>
        <Glow color={PLOT_COLORS.amber} size={0.16} strength={0.9} />
      </group>
    </View>
  );
}
