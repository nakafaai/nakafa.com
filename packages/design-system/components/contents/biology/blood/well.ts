import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/**
 * One cavity of a white porcelain blood grouping tile, in metres: about
 * 21 mm across and 2 mm deep, a shallow dish that holds a mixed drop where
 * the eye reads it against the white glaze.
 *
 * @see HiMedia GW099 blood grouping slide: 12 concavities of 21 mm diameter,
 * 2 mm deep, https://www.himedialabs.com/media/TD/GW099.pdf
 * @see UNICEF supply catalogue S0001502, opal glass blood grouping plate: wells
 * of about 20 mm by 3 mm, https://sd-scat-prod.unicef.org/s0001502.html
 */
export const CAVITY = { depth: 0.002, radius: 0.0105 } as const;

/**
 * The radius of the sphere a cavity's floor is cut from, in metres: a
 * spherical cap of base radius a and depth d lies on a sphere of radius
 * (a² + d²) / 2d.
 */
export const BOWL =
  (CAVITY.radius ** 2 + CAVITY.depth ** 2) / (2 * CAVITY.depth);

/**
 * One drop from a reagent dropper or a pipette, in cubic metres: 45 to
 * 50 microlitres. A test puts one drop of serum and one drop of blood in each
 * cavity.
 *
 * @see Rapid Biotec, "Monoclonal Blood Grouping Reagents Anti-A, Anti-B,
 * Anti-A,B" instructions for use (Doc Ref CE ABO RB 04/2024), slide method:
 * "one drop (45-50 µl)" of reagent and of cells.
 */
export const DROP = 50e-9;

/**
 * How far below the tile's top the cavity floor lies at `radius` metres from
 * its middle, in metres: the depth less the rise of the sphere at that
 * radius. Zero at the rim.
 */
export function floorAt(radius: number) {
  const reach = Math.min(radius, CAVITY.radius);
  return CAVITY.depth - (BOWL - Math.sqrt(BOWL ** 2 - reach ** 2));
}

/** The volume of liquid a cavity holds up to `level` metres above its lowest point, in cubic metres. */
export function capVolume(level: number) {
  return (Math.PI * level ** 2 * (3 * BOWL - level)) / 3;
}

/**
 * How deep a pool of `volume` cubic metres stands at the middle of a cavity,
 * in metres: the level whose cap holds that volume, found by halving the
 * interval, since the cap's volume rises with its level. A volume larger
 * than the cavity stands at its rim.
 */
export function poolDepth(volume: number) {
  if (volume >= capVolume(CAVITY.depth)) {
    return CAVITY.depth;
  }
  const rim: number = CAVITY.depth;
  return Arr.reduce(
    Arr.range(1, 48),
    { high: rim, low: 0 },
    ({ high, low }) => {
      const middle = (low + high) / 2;
      return capVolume(middle) < volume
        ? { high, low: middle }
        : { high: middle, low };
    }
  ).low;
}

/** The radius of the circle where a pool `depth` metres deep meets the cavity floor, in metres. */
export function poolRadius(depth: number) {
  return Math.sqrt(2 * BOWL * depth - depth ** 2);
}

/**
 * How bright a film of blood or serum `thickness` metres thick looks over
 * the white glaze, as a share of its thin edge: light passing down through
 * the film and back is absorbed more the thicker it is, so a drop's rim shows
 * paler than its middle. Never darker than 0.62, the share where whole blood
 * stops looking any deeper.
 */
export function filmShade(thickness: number) {
  return 0.62 + 0.38 * Math.exp(-thickness / 0.000_25);
}

/**
 * One grain of agglutinated red cells in a well: where it ends in the clump
 * it joins, where it starts as a fine speck while the cells are still free,
 * its radius in metres, and how far into the reaction it joins, from 0 to 1.
 */
const GrainSchema = Schema.Struct({
  from: Schema.Tuple([Schema.Finite, Schema.Finite]),
  join: Schema.Finite,
  radius: Schema.Finite,
  to: Schema.Tuple([Schema.Finite, Schema.Finite]),
});
type Grain = typeof GrainSchema.Type;

/**
 * How far one grain has gathered into its clump, from 0 to 1, when the
 * reaction has gone `clumping` of its way: each grain starts once the
 * reaction passes four fifths of its `join` share and has gathered after
 * three tenths more, eased in and out.
 */
export function gatherAt(clumping: number, join: number) {
  const share = Math.min(1, Math.max(0, (clumping - 0.8 * join) / 0.3));
  return share * share * (3 - 2 * share);
}

/** How many clumps a strongly positive well shows, as in the job aid's photo of a positive slide. */
const CLUMPS = 10;

/** How many grains each clump gathers. */
const GRAINS_PER_CLUMP = 8;

/** How many fine agglutinates stay scattered between the clumps. */
const SPECKS = 40;

/** The golden angle, which spreads points over a disc without lining them up. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** A point on the cavity floor, moved in towards the middle when it lies farther out than `limit` metres. */
function inside(point: readonly [number, number], limit: number) {
  const reach = Math.hypot(point[0], point[1]);
  if (reach <= limit) {
    return point;
  }
  return [(point[0] * limit) / reach, (point[1] * limit) / reach] as const;
}

/**
 * The grains of one positive well, deterministic for its `seed`: ten clumps
 * of a few millimetres spread evenly over a pool of radius `pool` metres,
 * each a walk of grains that turns sharply and so curls into a blotch, the
 * grains starting scattered, plus fine specks left between them, as a
 * positive slide shows little clumps of red cells in a clear liquid. Every
 * grain stays inside the pool.
 *
 * @see Fondation Mérieux, "Blood Grouping and Rh Typing Practices" job aid,
 * figure 2,
 * https://moodle.fondation-merieux.org/pluginfile.php/5014/mod_resource/content/1/Jobaid_Blood%20Grouping%20%20RhTyping.pdf
 */
export function grainsOf(seed: number, pool: number): readonly Grain[] {
  const clumps = Arr.flatMap(Arr.range(0, CLUMPS - 1), (clump) => {
    const spread = pool * 0.58 * Math.sqrt((clump + 0.5) / CLUMPS);
    const angle = clump * GOLDEN + hashUnit(seed, clump) * 0.6;
    const size = clump === 0 ? 1.4 : 0.8 + 0.45 * hashUnit(clump, seed + 7);
    const heading = hashUnit(seed + 3, clump) * Math.PI * 2;
    const chain = Arr.scan(
      Arr.range(1, GRAINS_PER_CLUMP - 1),
      [Math.cos(angle) * spread, Math.sin(angle) * spread] as const,
      ([x, z], grain) => {
        const turn = heading + (hashUnit(clump * 11 + grain, seed) - 0.5) * 4.4;
        const step = 0.000_42 * size;
        return [x + Math.cos(turn) * step, z + Math.sin(turn) * step] as const;
      }
    );
    return Arr.map(chain, (link, grain) => {
      const radius =
        (0.000_55 + 0.000_35 * hashUnit(grain + seed, clump + 17)) * size;
      const to = inside(link, pool * 0.92 - radius);
      const scatter = 0.0012 + 0.001 * hashUnit(grain, clump + seed);
      const away = hashUnit(grain + 5, clump * 3 + seed) * Math.PI * 2;
      return {
        from: inside(
          [to[0] + Math.cos(away) * scatter, to[1] + Math.sin(away) * scatter],
          pool * 0.92
        ),
        join: 0.15 + 0.6 * hashUnit(clump + seed, grain + 13),
        radius,
        to,
      } as const;
    });
  });
  const specks = Arr.map(Arr.range(0, SPECKS - 1), (speck) => {
    const reach = pool * 0.85 * Math.sqrt(hashUnit(speck, seed + 29));
    const angle = hashUnit(seed + 31, speck) * Math.PI * 2;
    const point = [Math.cos(angle) * reach, Math.sin(angle) * reach] as const;
    return {
      from: point,
      join: 0.05 + 0.3 * hashUnit(speck + 37, seed),
      radius: 0.0001 + 0.0001 * hashUnit(seed + 41, speck),
      to: point,
    } as const;
  });
  return [...clumps, ...specks];
}

/**
 * The white porcelain grouping tile, in metres: 100 mm by 130 mm and 6 mm
 * thick, with twelve cavities in three columns of four rows, 30 mm apart.
 *
 * @see Sigma-Aldrich BR473500 spotting tile: 130 x 100 x 6 mm, 12 cavities of
 * 20 to 22 mm, https://www.sigmaaldrich.com/US/en/product/aldrich/br473500
 */
export const TILE = {
  corner: 0.007,
  height: 0.006,
  length: 0.13,
  pitch: 0.03,
  width: 0.1,
} as const;

/** How many rows of cavities the tile has, one sample to a row. */
export const ROWS = 4;

/** The middle of the cavity of serum `column` across a row, in metres. */
export function columnX(column: number) {
  return (column - 1) * TILE.pitch;
}

/** The middle of row `row`, the first at the back, in metres. */
export function rowZ(row: number) {
  return (row - (ROWS - 1) / 2) * TILE.pitch;
}

/**
 * The row of the tile that sample `index` of `count` is tested in: the
 * samples fill the rows nearest the reader, in order from the back, so any
 * row left empty lies at the back by the vials.
 */
export function rowOf(index: number, count: number) {
  return ROWS - Math.min(count, ROWS) + index;
}

/** How high a drop's tip is held above the tile while it lets a drop go, in metres. */
export const TIP_HEIGHT = 0.012;
