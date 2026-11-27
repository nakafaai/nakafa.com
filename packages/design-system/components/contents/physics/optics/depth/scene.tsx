import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
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
import { Lens } from "@repo/design-system/components/three/optic/glass";
import {
  CROWN_INDEX,
  cellDrop,
} from "@repo/design-system/components/three/optic/lens";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { Vector2 } from "three";

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

/** The radius of the coin, and its turned outline: a raised rim round a struck face. */
const COIN = 0.17;
const COIN_PROFILE = Arr.map(
  [
    [0.0004, 0.014],
    [COIN * 0.82, 0.014],
    [COIN * 0.86, 0.02],
    [COIN * 0.97, 0.02],
    [COIN, 0.017],
    [COIN, 0.003],
    [COIN * 0.97, 0],
    [0.0004, 0],
  ] as const,
  ([radius, along]) => new Vector2(radius, along)
);

/** The coin, or as a `ghost` the image of it an eye sees where no coin is. */
function Coin({ ghost = false }: { readonly ghost?: boolean }) {
  return (
    <mesh castShadow={!ghost} renderOrder={ghost ? 6 : 0}>
      <latheGeometry args={[COIN_PROFILE, 64]} />
      <meshPhysicalMaterial
        color={INSTRUMENT_COLORS.brass}
        depthWrite={!ghost}
        metalness={1}
        opacity={ghost ? 0.4 : 1}
        roughness={0.34}
        transparent={ghost}
      />
    </mesh>
  );
}

/** A measure beside the tank from `from` up to `to`: a line with a foot at each end, in `color`. */
function Measure({
  color,
  from,
  to,
  x,
}: {
  readonly color: string;
  readonly from: number;
  readonly to: number;
  readonly x: number;
}) {
  return (
    <group position={[x, 0, DEEP / 2 + 0.04]}>
      {Arr.map(
        [
          { at: (from + to) / 2, size: [0.014, to - from, 0.004] },
          { at: from, size: [0.1, 0.014, 0.004] },
          { at: to, size: [0.1, 0.014, 0.004] },
        ] as const,
        (bar) => (
          <mesh key={bar.at} position={[0, bar.at, 0]}>
            <boxGeometry args={bar.size} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )
      )}
    </group>
  );
}

/**
 * A coin on the floor of a glass tank under layers of liquid, seen straight
 * down through a viewing lens on a stand. Two rays leave the coin and bend
 * away from the normal at every boundary on their way up, by Snell's law;
 * their dashed extensions lead back down to where they seem to come from,
 * and the ghost of the coin floats there. The teal measure is the real
 * depth and the amber one the apparent depth.
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
    <group>
      <BenchCamera
        narrow={[0.5, 2.4, 9.4]}
        target={[0.25, 1.35, 0]}
        wide={[0.9, 2.1, 5.9]}
      />
      <SeamlessBenchSurface />
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
        <Coin />
      </group>
      <group position={[0, image, 0]}>
        <Coin ghost />
        <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[COIN * 1.12, 0.006, 8, 64]} />
          <meshBasicMaterial color={PLOT_COLORS.amber} toneMapped={false} />
        </mesh>
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
      <group position={[reach + 0.62, 0, 0]}>
        <Stand height={eye + 0.03} reach={0.57} tall={eye + 0.5} />
      </group>
      <Measure
        color={PLOT_COLORS.teal}
        from={FLOOR}
        to={surface}
        x={WIDE / 2 + 0.16}
      />
      <Measure
        color={PLOT_COLORS.amber}
        from={image}
        to={surface}
        x={WIDE / 2 + 0.3}
      />
    </group>
  );
}
