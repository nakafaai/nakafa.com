import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  lensReach,
  principalRays,
  rayRun,
  thinLens,
} from "@repo/design-system/components/contents/physics/optics/ray";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Beam, Glow } from "@repo/design-system/components/three/optic/beam";
import {
  Backboard,
  Rail,
  Rider,
  Screen,
} from "@repo/design-system/components/three/optic/bench";
import { Lens } from "@repo/design-system/components/three/optic/glass";
import {
  CROWN_INDEX,
  cellDrop,
} from "@repo/design-system/components/three/optic/lens";
import { Arrow, Lamp } from "@repo/design-system/components/three/optic/source";
import { View } from "@repo/design-system/components/three/optic/view";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import { DoubleSide } from "three";

/** How high above the benchtop the optical axis runs. */
const AXIS = 1.5;

/** How high the top of the rail stands, which stops a ray that falls that far. */
const RAIL = 0.23;

/** How tall the lit arrow of the object is, and half the width of the lens. */
const TALL = 0.36;
const HALF = 0.46;

/**
 * How long the bench is in scene units, and how many focal lengths it gives
 * each side of the lens. It is long enough that the lamp at its nearest
 * still stands clear of the lens and of its carrier.
 */
const SPAN = 9;
const LEFT = 4.2;
const RIGHT = 4.3;

/** The size of the screen that catches a real image. */
const CARD = { tall: 2.5, wide: 1.1 } as const;

/** The marks along the bench, in focal lengths from the lens. */
const MARKS = [
  { at: -2, name: "2F" },
  { at: -1, name: "F" },
  { at: 1, name: "F" },
  { at: 2, name: "2F" },
] as const;

/**
 * How much of the bench the view holds beyond the reading at each end, in
 * scene units: the lamp house behind the object, and a margin past the image.
 */
const LEAD = { left: 0.36, right: 0.26 } as const;

/** The side the bench is read from: straight on, from a little above the axis. */
const FROM = [0, 0.55, 6] as const;

/**
 * A focal point of the diagram: a dot on the axis, drawn over whatever
 * stands there, and its name under it in front of the rail's scale, clear
 * of the rays.
 */
function Mark({ at, name }: { readonly at: number; readonly name: string }) {
  return (
    <group position={[at, 0, 0]}>
      <mesh position={[0, AXIS, 0]} renderOrder={12}>
        <circleGeometry args={[0.032, 28]} />
        <meshBasicMaterial
          color={PLOT_COLORS.amber}
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Tag position={[0, 0.02, 0.36]}>
        <InlineMath math={name} />
      </Tag>
    </group>
  );
}

/** One principal ray: its light from the tip through the lens, where it lands, and its extension back to a virtual image. */
function Ray({
  back,
  far,
  height,
  landing,
  slope,
  tip,
}: {
  readonly back: Option.Option<number>;
  readonly far: number;
  readonly height: number;
  readonly landing: boolean;
  readonly slope: number;
  readonly tip: readonly [number, number, number];
}) {
  return (
    <group>
      <Beam
        color={INSTRUMENT_COLORS.lampLight}
        points={[
          tip,
          [0, AXIS + height, 0],
          [far, AXIS + height + slope * far, 0],
        ]}
        strength={0.85}
      />
      {landing ? (
        <group
          position={[far - 0.004, AXIS + height + slope * far, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <Glow color={INSTRUMENT_COLORS.lampLight} size={0.3} strength={0.6} />
        </group>
      ) : null}
      {Option.match(back, {
        onNone: () => null,
        onSome: (to) => (
          <Beam
            color={INSTRUMENT_COLORS.lampLight}
            dashed
            points={[
              [0, AXIS + height, 0],
              [to, AXIS + height + slope * to, 0],
            ]}
            strength={0.8}
          />
        ),
      })}
    </group>
  );
}

/**
 * A convex lens on an optical bench between a lit arrow and a screen. The
 * three principal rays leave the tip of the arrow, bend at the lens by the
 * thin lens law, and meet at the tip of the real image, which the screen
 * stands at to catch. Inside the focal point they spread instead, and their
 * dashed extensions lead back to the upright virtual image on the same side
 * as the arrow. The object is marked in teal and its image in pink, in the
 * plane of the rays, and the view holds the bench from the object to the
 * image, so the diagram fills the frame wherever the object stands.
 */
export function LensScene({
  focal,
  object,
}: {
  /** The focal length of the lens, in centimetres. */
  readonly focal: number;
  /** How far in front of the lens the object stands, in centimetres. */
  readonly object: number;
}) {
  const unit = SPAN / ((LEFT + RIGHT) * focal);
  const left = LEFT * focal * unit;
  const right = RIGHT * focal * unit;
  const length = left + right + 0.5;
  const image = thinLens(focal, object);
  const caught = Option.filter(
    image,
    (found) => found.real && found.distance * unit <= right - 0.1
  );
  const stop = Option.match(caught, {
    onNone: () => right,
    onSome: (found) => found.distance * unit,
  });
  const virtual = Option.filter(image, (found) => !found.real);
  const rays = Arr.filter(
    principalRays(focal * unit, object * unit, TALL),
    (ray) => Math.abs(ray.height) <= HALF * 0.94
  );
  const glass = {
    focal: focal * unit,
    half: HALF,
    index: CROWN_INDEX,
    thin: 0.03,
  };
  const reach = lensReach(focal, object, {
    left: LEFT * focal,
    right: RIGHT * focal,
  });

  return (
    <View
      box={{
        x: {
          max: reach.right * unit + LEAD.right,
          min: -reach.left * unit - LEAD.left,
        },
        y: { max: AXIS + CARD.tall / 2 + 0.06, min: -0.16 },
        z: { max: 0.4, min: -0.3 },
      }}
      from={FROM}
    >
      <Backboard back={0.8} tall={3} wide={length + 0.7} />
      <group position={[(right - left) / 2, 0, 0]}>
        <Rail length={length} unit={unit} />
      </group>
      <Rider at={-object * unit} drop={0.2 - TALL / 2} height={AXIS}>
        <Lamp tall={TALL}>
          <Arrow color={PLOT_COLORS.teal} tall={TALL} />
        </Lamp>
      </Rider>
      <Rider at={0} drop={cellDrop(glass)} height={AXIS}>
        <Lens focal={glass.focal} half={HALF} thin={glass.thin} />
      </Rider>
      <Rider at={stop} drop={CARD.tall / 2 + 0.02} height={AXIS}>
        <Screen tall={CARD.tall} wide={CARD.wide}>
          {Option.match(caught, {
            onNone: () => null,
            onSome: (found) => (
              <Arrow
                color={PLOT_COLORS.teal}
                strength={Math.min(1, 1 / Math.abs(found.magnification))}
                tall={TALL * found.magnification}
              />
            ),
          })}
        </Screen>
      </Rider>
      <Beam
        color={INSTRUMENT_COLORS.paper}
        dashed
        points={[
          [-left, AXIS, 0],
          [right, AXIS, 0],
        ]}
        strength={0.5}
        width={0.006}
      />
      {Arr.map(rays, (ray) => {
        const onCard = Math.abs(ray.height + ray.slope * stop) < CARD.tall / 2;
        return (
          <Ray
            back={Option.map(virtual, (found) =>
              Math.max(found.distance * unit, -left)
            )}
            far={
              onCard
                ? stop - 0.008
                : rayRun(ray.height, ray.slope, AXIS - RAIL, right + 0.5)
            }
            height={ray.height}
            key={ray.height}
            landing={onCard && Option.isNone(caught)}
            slope={ray.slope}
            tip={[-object * unit, AXIS + TALL, 0]}
          />
        );
      })}
      <group position={[-object * unit, AXIS, 0]}>
        <Arrow color={PLOT_COLORS.teal} mark tall={TALL} />
      </group>
      {Option.match(caught, {
        onNone: () => null,
        onSome: (found) => (
          <group position={[found.distance * unit, AXIS, 0]}>
            <Arrow
              color={PLOT_COLORS.pink}
              mark
              tall={TALL * found.magnification}
            />
          </group>
        ),
      })}
      {Option.match(
        Option.filter(virtual, (found) => -found.distance * unit <= left),
        {
          onNone: () => null,
          onSome: (found) => (
            <group position={[found.distance * unit, AXIS, 0]}>
              <Arrow
                color={PLOT_COLORS.pink}
                ghost
                mark
                tall={TALL * found.magnification}
              />
            </group>
          ),
        }
      )}
      {Arr.map(MARKS, (mark) => (
        <Mark at={mark.at * focal * unit} key={mark.at} name={mark.name} />
      ))}
    </View>
  );
}
