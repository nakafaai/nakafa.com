import { Array as Arr, Option, pipe, Schema } from "effect";

/**
 * The model car of the brake lab: its mass in kilograms, and four cast iron
 * brake discs of 8 kg that share the heat equally. A real car sends more of
 * the work to its front brakes; equal sharing keeps one number per stop.
 */
export const CAR_MASS = 1200;
export const DISC_MASS = 8;
export const DISC_COUNT = 4;

/**
 * The specific heat capacity of iron at 25 °C, 0.449 J/(g·K), from the CRC
 * Handbook of Chemistry and Physics ("Heat Capacity of the Elements at
 * 25 °C"); grey cast iron discs sit close to it.
 */
export const IRON_HEAT_CAPACITY = 449;

/** The air and the discs before the stop, in °C: a warm tropical day. */
export const START_TEMPERATURE = 30;

/** The kinetic energy of the model car at `speed` m/s, in joules: ½mv². */
export function kineticEnergy(speed: number) {
  return (CAR_MASS * speed ** 2) / 2;
}

/**
 * How much one disc warms when the brakes turn all of the car's kinetic
 * energy into heat: Q = m·c·ΔT, shared by every disc.
 */
export function temperatureRise(speed: number) {
  return kineticEnergy(speed) / (DISC_COUNT * DISC_MASS * IRON_HEAT_CAPACITY);
}

/**
 * The disc temperature after `fraction` of the stop, where the energy left
 * falls with the square of the speed left: braking from v to v·(1 − f)
 * releases ½m(v² − v²(1 − f)²).
 */
export function discTemperature(speed: number, fraction: number) {
  const left = 1 - Math.min(1, Math.max(0, fraction));
  return START_TEMPERATURE + temperatureRise(speed) * (1 - left ** 2);
}

/**
 * The thermal camera's palette, coolest first, as sRGB channels in 0 to 1 and the
 * temperature each stop marks. It runs from a dark blue through red and orange
 * to a pale yellow, as an ironbow palette does.
 */
const PaletteStopSchema = Schema.Struct({
  rgb: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  temperature: Schema.Finite,
});
type PaletteStop = typeof PaletteStopSchema.Type;

const PALETTE: readonly [PaletteStop, ...PaletteStop[]] = [
  { rgb: [0.04, 0.02, 0.18], temperature: 30 },
  { rgb: [0.36, 0.03, 0.46], temperature: 38 },
  { rgb: [0.78, 0.1, 0.26], temperature: 48 },
  { rgb: [0.98, 0.42, 0.06], temperature: 58 },
  { rgb: [1, 0.8, 0.2], temperature: 66 },
  { rgb: [1, 0.98, 0.82], temperature: 74 },
];

/** The colour a thermal camera paints a surface at `temperature` °C. */
export function thermalColor(temperature: number) {
  const first = Arr.headNonEmpty(PALETTE);
  const last = Arr.lastNonEmpty(PALETTE);
  if (temperature <= first.temperature) {
    return first.rgb;
  }
  return pipe(
    Arr.findFirstIndex(PALETTE, (stop) => stop.temperature >= temperature),
    Option.flatMap((upper) =>
      Option.all([Arr.get(PALETTE, upper - 1), Arr.get(PALETTE, upper)])
    ),
    Option.match({
      onNone: () => last.rgb,
      onSome: ([low, high]) => {
        const progress =
          (temperature - low.temperature) /
          (high.temperature - low.temperature);
        return Arr.zipWith(
          low.rgb,
          high.rgb,
          (from, to) => from + (to - from) * progress
        );
      },
    })
  );
}
