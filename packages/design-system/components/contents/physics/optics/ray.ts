import {
  bend,
  converge,
} from "@repo/design-system/components/three/optic/trace";
import { Array as Arr, Option, Schema } from "effect";

/**
 * Geometric optics for the light labs. Snell's law, n₁ sin θ₁ = n₂ sin θ₂,
 * bends a ray at a boundary, and a ray that would need sin θ₂ above one is
 * totally reflected instead, which happens past the critical angle,
 * sin c = n₂ / n₁. A thin lens follows 1/f = 1/u + 1/v with real distances
 * positive. A layer of thickness t and refractive index n looks t / n deep
 * when seen straight down, and an astronomical telescope in normal adjustment
 * has its lenses f_o + f_e apart and magnifies f_o / f_e.
 */

/** Degrees in one radian, so the labs can read and write angles in degrees. */
const DEGREE = Math.PI / 180;

/** The refractive index of air, taken as exactly one. */
const AIR_INDEX = 1;

/** The sine of an angle given in degrees. */
function sine(degrees: number) {
  return Math.sin(degrees * DEGREE);
}

/** The angle in degrees whose sine is `value`. */
function arcsine(value: number) {
  return Math.asin(value) / DEGREE;
}

/**
 * The angle of refraction, in degrees, of a ray that meets a boundary from a
 * medium of index `from` into one of index `to` at `incidence` degrees from
 * the normal, or none when the ray is totally reflected.
 */
export function refract(from: number, to: number, incidence: number) {
  const bent = (from / to) * sine(incidence);
  return bent > 1 ? Option.none<number>() : Option.some(arcsine(bent));
}

/** The critical angle, in degrees, for light leaving a medium of index `index` into air. */
export function criticalAngle(index: number) {
  return arcsine(AIR_INDEX / index);
}

/** A rectangular glass block seen from the side: its width, its height, and its refractive index. */
const BlockSchema = Schema.Struct({
  height: Schema.Finite,
  index: Schema.Finite,
  width: Schema.Finite,
});
export type Block = typeof BlockSchema.Type;

/** A point of a traced ray in the block's frame: x to the right of its left face, y up from its bottom face. */
const SpotSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type Spot = typeof SpotSchema.Type;

/** How a ray leaves a face: it refracts out into the air, or it is totally reflected back into the glass. */
const FaceEventSchema = Schema.Literals(["refracted", "reflected"]);

/** One face a traced ray reaches inside the block. */
const HitSchema = Schema.Struct({
  at: SpotSchema,
  event: FaceEventSchema,
  /** The angle between the ray inside the glass and the face's normal, in degrees. */
  incidence: Schema.Finite,
  face: Schema.Literals(["bottom", "left", "right"]),
});
type Hit = typeof HitSchema.Type;

/** The face of the block a ray inside it reaches first, and where, travelling from `at` along `(dx, dy)`. */
function nextFace(block: Block, at: Spot, dx: number, dy: number) {
  const toSide = dx > 0 ? (block.width - at.x) / dx : -at.x / dx;
  const toBottom = -at.y / dy;
  if (dx !== 0 && toSide < toBottom) {
    return {
      at: { x: dx > 0 ? block.width : 0, y: at.y + dy * toSide },
      face: dx > 0 ? ("right" as const) : ("left" as const),
    };
  }
  return { at: { x: at.x + dx * toBottom, y: 0 }, face: "bottom" as const };
}

/**
 * Traces a ray in air that strikes the top face of a glass block at `entry`
 * metres from its left face, `incidence` degrees from the normal and
 * travelling to the right. It refracts into the glass, then at each face it
 * reaches it either refracts out or, past the critical angle, reflects. A
 * ray that entered through the top meets the bottom at its angle of
 * refraction, below the critical angle, so it always leaves there; only the
 * side faces can reflect it. The trace stops once the ray is out, or after
 * four faces.
 */
export function traceBlock(block: Block, entry: number, incidence: number) {
  // Light entering denser glass from air always refracts, so no fallback is needed.
  const refraction = arcsine((AIR_INDEX / block.index) * sine(incidence));
  const dy = -Math.cos(refraction * DEGREE);
  const bounce = (
    at: Spot,
    dx: number,
    hits: readonly Hit[]
  ): readonly Hit[] => {
    const reached = nextFace(block, at, dx, dy);
    const along = reached.face === "bottom" ? Math.abs(dy) : Math.abs(dx);
    const angle = Math.acos(Math.min(along, 1)) / DEGREE;
    const out = refract(block.index, AIR_INDEX, angle);
    const next = Arr.append(hits, {
      at: reached.at,
      event: Option.isSome(out)
        ? ("refracted" as const)
        : ("reflected" as const),
      face: reached.face,
      incidence: angle,
    });
    return Option.isSome(out) || next.length >= 4
      ? next
      : bounce(reached.at, -dx, next);
  };
  return {
    hits: bounce({ x: entry, y: block.height }, sine(refraction), []),
    refraction,
  };
}

/** The inward normal of each face of the block a ray can leave through, in the block's frame. */
const FACE_NORMALS = {
  bottom: [0, 1],
  left: [1, 0],
  right: [-1, 0],
} as const;

/**
 * The whole path of the ray of `traceBlock` in the block's frame, for a ray
 * box that stands `reach` from the point of entry: from its slit to the top
 * face, through every face the ray meets inside the glass, and `reach` on
 * into the air once it refracts out, bent there by Snell's law. `mirror` is
 * where the weak part the top face reflects ends, as far from the entry as
 * the slit is.
 */
export function blockPath(
  block: Block,
  entry: number,
  incidence: number,
  reach: number
) {
  const { hits, refraction } = traceBlock(block, entry, incidence);
  const lean = sine(incidence) * reach;
  const rise = Math.cos(incidence * DEGREE) * reach;
  const top: Spot = { x: entry, y: block.height };
  const inside = [top, ...Arr.map(hits, (hit) => hit.at)];
  const leaves = Option.flatMap(
    Arr.last(Arr.zip(inside, hits)),
    ([before, hit]) => {
      const long = Math.hypot(hit.at.x - before.x, hit.at.y - before.y);
      return Option.map(
        bend(
          [(hit.at.x - before.x) / long, (hit.at.y - before.y) / long],
          FACE_NORMALS[hit.face],
          block.index,
          AIR_INDEX
        ),
        ([x, y]): Spot => ({
          x: hit.at.x + x * reach,
          y: hit.at.y + y * reach,
        })
      );
    }
  );
  return {
    hits,
    mirror: { x: entry + lean, y: block.height + rise },
    path: [
      { x: entry - lean, y: block.height + rise },
      ...inside,
      ...Option.toArray(leaves),
    ],
    refraction,
  };
}

/** One layer of liquid in a container: its thickness in centimetres and its refractive index. */
const LayerSchema = Schema.Struct({
  index: Schema.Finite,
  thickness: Schema.Finite,
});
type Layer = typeof LayerSchema.Type;

/**
 * Where an object on the bottom of a container of stacked layers appears
 * when seen straight down: each layer looks its thickness over its index
 * deep, so the apparent depth is their sum, and the image sits that far
 * below the top surface. Heights are in centimetres, up from the bottom.
 */
export function apparentDepth(layers: Arr.NonEmptyReadonlyArray<Layer>) {
  let real = 0;
  let apparent = 0;
  for (const layer of layers) {
    real += layer.thickness;
    apparent += layer.thickness / layer.index;
  }
  return { apparent, image: real - apparent, real };
}

/** The tangent of an angle given in degrees. */
function tangent(degrees: number) {
  return Math.tan(degrees * DEGREE);
}

/**
 * Traces a ray that leaves the bottom of a stack of layers at `angle`
 * degrees from the vertical up to the air above. Layers run from the top
 * down; the result lists where the ray crosses each boundary, from the
 * bottom up, as its sideways offset and height in centimetres.
 */
export function traceLayers(
  layers: Arr.NonEmptyReadonlyArray<Layer>,
  angle: number
) {
  const bottomUp = Arr.reverse(layers);
  const lean = Arr.headNonEmpty(bottomUp).index * sine(angle);
  const floor: Spot = { x: 0, y: 0 };
  const crossings = Arr.scan(bottomUp, floor, (spot, layer) => ({
    x: spot.x + layer.thickness * tangent(arcsine(lean / layer.index)),
    y: spot.y + layer.thickness,
  }));
  return { crossings, emerges: arcsine(lean / AIR_INDEX) };
}

/** The image of a thin lens, or none when the object stands at the focal point. */
const ImageSchema = Schema.Struct({
  /** The image distance in centimetres, positive for a real image behind the lens. */
  distance: Schema.Finite,
  /** The image height over the object height, negative when the image is inverted. */
  magnification: Schema.Finite,
  real: Schema.Boolean,
});
export type Image = typeof ImageSchema.Type;

/** The image a thin lens of focal length `focal` forms of an object `object` in front of it, both in centimetres. */
export function thinLens(focal: number, object: number) {
  if (object === focal) {
    return Option.none<Image>();
  }
  const distance = 1 / (1 / focal - 1 / object);
  return Option.some({
    distance,
    magnification: -distance / object,
    real: distance > 0,
  });
}

/**
 * How far either side of a thin lens a reader must see to read its ray
 * diagram, in centimetres: as far as the object, the 2F mark on each side,
 * and the image wherever it forms. An image farther than `farthest` on its
 * side is off the bench, so the reading stops at the end of the bench there.
 */
export function lensReach(
  focal: number,
  object: number,
  farthest: { readonly left: number; readonly right: number }
) {
  const image = Option.match(thinLens(focal, object), {
    onNone: () => 0,
    onSome: (found) => found.distance,
  });
  return {
    left: Math.min(Math.max(object, 2 * focal, -image), farthest.left),
    right: Math.min(Math.max(2 * focal, image), farthest.right),
  };
}

/**
 * The three principal rays from the tip of an object `tall` high that stands
 * `object` in front of a thin lens of focal length `focal`: where each meets
 * the lens above the axis, and its slope once the lens has bent it. The ray
 * parallel to the axis leaves through the far focal point, the ray through
 * the centre goes straight on, and the ray through the near focal point
 * leaves parallel, which no ray does when the object stands at that point.
 */
export function principalRays(focal: number, object: number, tall: number) {
  return [
    { height: tall, slope: converge(tall, 0, focal) },
    { height: 0, slope: -tall / object },
    ...(object === focal
      ? []
      : [{ height: (tall * focal) / (focal - object), slope: 0 }]),
  ];
}

/**
 * A ray from a distant star that meets the objective of a telescope in
 * normal adjustment `height` above the axis, with the slope `tilt`: where it
 * crosses the shared focal plane and the eyepiece, and its slope as it
 * leaves. Every such ray crosses the focal plane at one height, where the
 * objective forms the image of the star, and leaves at one slope, steeper
 * than it came by the ratio of the focal lengths.
 */
export function starRay(
  height: number,
  tilt: number,
  lenses: { readonly eyepiece: number; readonly objective: number }
) {
  const inside = converge(height, tilt, lenses.objective);
  const image = height + inside * lenses.objective;
  const atEyepiece = image + inside * lenses.eyepiece;
  return {
    atEyepiece,
    image,
    out: converge(atEyepiece, inside, lenses.eyepiece),
  };
}

/**
 * An astronomical telescope in normal adjustment from the powers of its
 * lenses in dioptres: each focal length in centimetres, the distance between
 * the lenses, and the angular magnification.
 */
export function telescope(objectivePower: number, eyepiecePower: number) {
  const objective = 100 / objectivePower;
  const eyepiece = 100 / eyepiecePower;
  return {
    eyepiece,
    length: objective + eyepiece,
    magnification: objective / eyepiece,
    objective,
  };
}
