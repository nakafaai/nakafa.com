import { Stand } from "@repo/design-system/components/contents/physics/bench/stand";
import {
  Tank,
  TankLiquid,
} from "@repo/design-system/components/contents/physics/bench/vessel";
import {
  apparentDepth,
  traceLayers,
} from "@repo/design-system/components/contents/physics/optics/ray";
import { Beam } from "@repo/design-system/components/three/optic/beam";
import { Backboard } from "@repo/design-system/components/three/optic/bench";
import { Coin } from "@repo/design-system/components/three/optic/coin";
import { Lens } from "@repo/design-system/components/three/optic/glass";
import {
  CROWN_INDEX,
  cellDrop,
} from "@repo/design-system/components/three/optic/lens";
import { Span } from "@repo/design-system/components/three/optic/mark";
import { View } from "@repo/design-system/components/three/optic/view";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";

/** The liquids the tank can hold, each in its own colour. */
const LiquidSchema = Schema.Literals(["water", "oil", "glycerine", "alcohol"]);
export type Liquid = typeof LiquidSchema.Type;

/** How each liquid looks through the glass. */
const LIQUID_COLORS = {
  alcohol: BENCH_COLORS.glass,
  glycerine: REAGENT_COLORS.solution,
  oil: ENERGY_COLORS.dieselFuel,
  water: ENERGY_COLORS.kettleWater,
} as const satisfies Record<Liquid, string>;

/** One poured layer: what it is, how thick it is in centimetres, and its refractive index. */
const PouredLayerSchema = Schema.Struct({
  index: Schema.Finite,
  liquid: LiquidSchema,
  thickness: Schema.Finite,
});
export type PouredLayer = typeof PouredLayerSchema.Type;

/** The angle from the vertical, in degrees, of the two rays drawn from the coin in the bottom layer. */
const RAY_ANGLE = 7;

/** How tall the liquid stands when the tank is full, and the tank's inside width and depth, in scene units. */
const FULL = 1.9;
const WIDE = 1.5;
const DEEP = 0.9;

/** How high the floor of the tank stands above the bench: its sealing strip and its plate of glass. */
const FLOOR = 0.046;

/** How far above the top of the liquid the viewing lens hangs, in centimetres of the lab. */
const VIEW = 6;

/** The viewing lens an eye looks straight down through. */
const VIEWER = { focal: 1.4, half: 0.3, index: CROWN_INDEX, thin: 0.03 };

/** How far from the viewing lens its stand is: far enough that the stand's base clears the tank. */
const STAND = 0.86;

/** The side the tank is read from: straight on, level with the liquid. */
const FROM = [0, 0.35, 6] as const;

/**
 * A coin on the floor of a glass tank under layers of liquid, seen straight
 * down through a viewing lens on a stand. Two rays leave the coin and bend
 * away from the normal at every boundary on their way up, by Snell's law;
 * their dashed extensions lead back down to where they seem to come from,
 * and the ghost of the coin floats there. The teal measure is the real
 * depth and the amber one the apparent depth. The view holds the tank from
 * its floor to the viewing lens, so the depths fill the frame.
 */
export function DepthScene({
  capacity,
  layers,
}: {
  /** The deepest the tank gets, in centimetres. */
  readonly capacity: number;
  /** The poured layers, from the top down. */
  readonly layers: Arr.NonEmptyReadonlyArray<PouredLayer>;
}) {
  const unit = FULL / capacity;
  const depth = apparentDepth(layers);
  const surface = FLOOR + depth.real * unit;
  const image = FLOOR + depth.image * unit;
  const eye = surface + VIEW * unit;
  const { crossings, emerges } = traceLayers(layers, RAY_ANGLE);
  const lean = Math.tan((emerges * Math.PI) / 180);
  const top = Arr.lastNonEmpty(crossings);
  const reach = cellDrop(VIEWER);
  const stacked = Arr.scan(
    Arr.reverse(layers),
    0,
    (sum, layer) => sum + layer.thickness * unit
  );

  return (
    <View
      box={{
        x: { max: reach + STAND + 0.25, min: -WIDE / 2 - 0.12 },
        y: { max: eye + 0.52, min: -0.04 },
        z: { max: DEEP / 2 + 0.08, min: -DEEP / 2 },
      }}
      from={FROM}
    >
      <Backboard back={1.1} tall={3.1} wide={5.2} />
      <Tank depth={DEEP} height={FULL * 1.08 + 0.03} width={WIDE} />
      {Arr.map(Arr.reverse(layers), (layer, index) => (
        <group key={layer.liquid} position={[0, stacked[index] ?? 0, 0]}>
          <TankLiquid
            color={LIQUID_COLORS[layer.liquid]}
            depth={DEEP}
            level={layer.thickness * unit}
            width={WIDE}
          />
        </group>
      ))}
      <group position={[0, FLOOR, 0]}>
        <Coin color={INSTRUMENT_COLORS.brass} />
      </group>
      <group position={[0, image, 0]}>
        <Coin color={INSTRUMENT_COLORS.brass} ghost ring={PLOT_COLORS.amber} />
      </group>
      {Arr.map([-1, 1] as const, (side) => (
        <group key={side}>
          <Beam
            color={INSTRUMENT_COLORS.lampLight}
            points={[
              ...Arr.map(
                crossings,
                (spot) =>
                  [side * spot.x * unit, FLOOR + spot.y * unit, 0] as const
              ),
              [side * (top.x * unit + lean * (eye - surface)), eye, 0],
            ]}
            strength={0.9}
            width={0.011}
          />
          <Beam
            color={INSTRUMENT_COLORS.lampLight}
            dashed
            points={[
              [side * top.x * unit, surface, 0],
              [side * (top.x * unit - lean * (surface - image)), image, 0],
            ]}
            strength={0.8}
            width={0.008}
          />
        </group>
      ))}
      <group position={[0, eye + 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <Lens focal={VIEWER.focal} half={VIEWER.half} thin={VIEWER.thin} />
      </group>
      <group position={[reach + STAND, 0, 0]}>
        <Stand height={eye + 0.03} reach={STAND - 0.05} tall={eye + 0.5} />
      </group>
      <group
        position={[WIDE / 2 + 0.16, FLOOR, DEEP / 2 + 0.04]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <Span
          color={PLOT_COLORS.teal}
          foot={0.1}
          long={surface - FLOOR}
          thick={0.014}
        />
      </group>
      <group
        position={[WIDE / 2 + 0.3, image, DEEP / 2 + 0.04]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <Span
          color={PLOT_COLORS.amber}
          foot={0.1}
          long={surface - image}
          thick={0.014}
        />
      </group>
    </View>
  );
}
