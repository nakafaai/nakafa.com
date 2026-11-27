import { Array as Arr, Schema } from "effect";

/**
 * The shape of a real spherical lens, from the numbers that make it one. The
 * lensmaker's equation for a symmetric lens in air, 1/f = (n - 1) 2/R, gives
 * the radius its two faces are ground to, and a sphere of that radius stands
 * R - sqrt(R^2 - h^2) proud of its chord at a height h, which is how thick
 * the glass is in the middle of a converging lens and at the rim of a
 * diverging one.
 */

/** The refractive index of the crown glass school lenses are ground from. */
export const CROWN_INDEX = 1.52;

/** How much of the sphere's radius the aperture may take, so a strong lens never becomes a full ball. */
const WIDEST = 0.94;

/** How far the cell that holds a lens reaches beyond its rim. */
export const CELL_WALL = 0.045;

/** How long the stem under a lens cell is, which a carrier's post takes. */
const STEM = 0.06;

/** How many points trace each ground face from the axis to the rim. */
const STEPS = 28;

/** What a lens is: its focal length, the half width of its aperture, the glass at its thinnest, and its index. */
const LensSchema = Schema.Struct({
  /** The focal length, positive for a converging lens and negative for a diverging one. */
  focal: Schema.Finite,
  /** Half the width of the lens across its rim. */
  half: Schema.Finite,
  /** The refractive index of its glass. */
  index: Schema.Finite,
  /** The thickness of the glass where it is thinnest: the rim of a converging lens, the middle of a diverging one. */
  thin: Schema.Finite,
});
type Lens = typeof LensSchema.Type;

/** The radius each face of a symmetric lens is ground to, positive for a converging lens. */
export function curvature(focal: number, index: number) {
  return 2 * (index - 1) * focal;
}

/** How far a sphere of `radius` stands proud of its chord at `height` from the axis. */
export function sag(radius: number, height: number) {
  const reach = Math.min(Math.abs(height), Math.abs(radius));
  return Math.abs(radius) - Math.sqrt(radius * radius - reach * reach);
}

/**
 * The outline of a lens as points to turn about its axis, each a distance
 * from the axis and a place along it, from the middle of the back face out
 * to the ground rim and back in to the middle of the front face. The rim is
 * a flat ground band with a small bevel at each edge, as a real lens has.
 */
export function lensProfile(lens: Lens) {
  const ground = curvature(lens.focal, lens.index);
  const half = Math.min(lens.half, Math.abs(ground) * WIDEST);
  const deep = sag(ground, half);
  const bulge = ground > 0 ? 1 : -1;
  const rim = ground > 0 ? lens.thin : lens.thin + 2 * deep;
  const bevel = Math.min(rim * 0.18, half * 0.04);
  const face = (side: number) =>
    Arr.makeBy(STEPS + 1, (step) => {
      const height = (half - bevel) * (step / STEPS);
      const proud = deep - sag(ground, height);
      return [height, side * (rim / 2 + bulge * proud)] as const;
    });
  return {
    half,
    points: [
      ...face(-1),
      [half, -rim / 2 + bevel] as const,
      [half, rim / 2 - bevel] as const,
      ...Arr.reverse(face(1)),
    ],
    thickness: ground > 0 ? rim + 2 * deep : lens.thin,
  };
}

/**
 * How far below its axis a mounted lens reaches, cell and stem included, so
 * the carrier that holds it knows where its post ends. The aperture is the
 * one the lens really gets, which a strong lens narrows.
 */
export function cellDrop(lens: Lens) {
  return lensProfile(lens).half + CELL_WALL + STEM;
}
