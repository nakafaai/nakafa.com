import { Array as Arr, Option, Order, Schema } from "effect";

/**
 * Where everything lies on the classroom floor, in metres: the activity mat
 * that is the universal set, the hula hoops that are the sets on it, the
 * tray the objects wait on, and the place each object comes to rest in its
 * region. The mat's middle is the origin, x runs right and z toward the
 * learner.
 */

/** A 1.8 m by 1.4 m canvas activity mat, 6 mm thick. */
export const MAT = { depth: 1.4, thickness: 0.006, width: 1.8 } as const;

/** A hula hoop for older children: 84 cm across the middle of its 22 mm tube. */
export const HOOP = { radius: 0.42, tube: 0.011 } as const;

/** A wooden tray in front of the mat, 52 cm by 32 cm inside. */
export const TRAY = {
  depth: 0.32,
  gap: 0.05,
  rim: 0.012,
  width: 0.52,
} as const;

/** Where the middle of the tray lies, in front of the mat. */
export const TRAY_Z = MAT.depth / 2 + TRAY.gap + TRAY.depth / 2 + TRAY.rim;

/** How far apart two resting objects stand, middle to middle: no object is wider than 9 cm. */
export const SPACING = 0.09;

/** How close an object's middle may come to a hoop's tube or the mat's edge. */
const CLEARANCE = 0.06;

/** How far the hoops' middles stand from the middle of the mat. */
const SPREAD = { three: 0.26, two: 0.25 } as const;

/** How far three hoops sit toward the back, so the triangle is centred front to back. */
const SHIFT = 0.05;

/** One place on the floor, in metres. */
export const PlaceSchema = Schema.Struct({
  x: Schema.Finite,
  z: Schema.Finite,
});
export type Place = typeof PlaceSchema.Type;

/**
 * The middles of the hoops: two side by side, or three in a triangle with A
 * and B at the back and C in front, overlapping so every region is there.
 */
export function hoopCentres(sets: number): readonly Place[] {
  if (sets === 2) {
    return [
      { x: -SPREAD.two, z: 0 },
      { x: SPREAD.two, z: 0 },
    ];
  }
  return Arr.map([150, 30, 270], (degrees) => {
    const angle = (degrees * Math.PI) / 180;
    return {
      x: SPREAD.three * Math.cos(angle),
      z: -SPREAD.three * Math.sin(angle) - SHIFT,
    };
  });
}

/** The region a place lies in: one bit for each hoop it is inside. */
export function regionAt(place: Place, centres: readonly Place[]) {
  return Arr.reduce(centres, 0, (region, centre, index) =>
    Math.hypot(place.x - centre.x, place.z - centre.z) < HOOP.radius
      ? region + 2 ** index
      : region
  );
}

/** How far a hoop's letter stands from the hoop's middle. */
const LETTER_REACH = HOOP.radius + 0.09;

/** The turns, in degrees, a letter tries away from straight out when the mat's edge is too near. */
const LETTER_TURNS = [0, -15, 15, -30, 30, -45, 45] as const;

/** Whether a letter's place lies on the mat, a margin inside its edge. */
function onMat(place: Place) {
  return (
    Math.abs(place.x) <= MAT.width / 2 - 0.06 &&
    Math.abs(place.z) <= MAT.depth / 2 - 0.06
  );
}

/**
 * Where each hoop's letter lies: on the mat just outside the hoop, on the
 * side away from the other hoops, or turned toward the nearest side when
 * the mat's edge leaves no room straight out.
 */
export function letterPlaces(centres: readonly Place[]): readonly Place[] {
  const middle = {
    x: Arr.reduce(centres, 0, (sum, centre) => sum + centre.x) / centres.length,
    z: Arr.reduce(centres, 0, (sum, centre) => sum + centre.z) / centres.length,
  };
  return Arr.map(centres, (centre) => {
    const away = Math.atan2(centre.z - middle.z, centre.x - middle.x);
    const tries = Arr.map(LETTER_TURNS, (turn) => {
      const angle = away + (turn * Math.PI) / 180;
      return {
        x: centre.x + LETTER_REACH * Math.cos(angle),
        z: centre.z + LETTER_REACH * Math.sin(angle),
      };
    });
    return Arr.findFirst(tries, onMat).pipe(
      Option.getOrElse(() => Arr.getUnsafe(tries, 0))
    );
  });
}

/** Where the universal set's symbol lies: the mat's back left corner. */
export const UNIVERSE_PLACE: Place = {
  x: -MAT.width / 2 + 0.07,
  z: -MAT.depth / 2 + 0.07,
};

/** Whether a place keeps clear of every hoop's tube, the mat's edge and the printed symbols. */
function clear(
  place: Place,
  centres: readonly Place[],
  reserved: readonly Place[]
) {
  return (
    Math.abs(place.x) <= MAT.width / 2 - CLEARANCE &&
    Math.abs(place.z) <= MAT.depth / 2 - CLEARANCE &&
    Arr.every(
      centres,
      (centre) =>
        Math.abs(
          Math.hypot(place.x - centre.x, place.z - centre.z) - HOOP.radius
        ) >= CLEARANCE
    ) &&
    Arr.every(
      reserved,
      (symbol) => Math.hypot(place.x - symbol.x, place.z - symbol.z) >= 0.09
    )
  );
}

/** How finely the mat is searched for resting places. */
const SEARCH_STEP = 0.01;

/** Every searched point of the mat, a centimetre apart. */
const SEARCH = Arr.flatMap(
  Arr.range(0, Math.round(MAT.depth / SEARCH_STEP)),
  (row) =>
    Arr.map(Arr.range(0, Math.round(MAT.width / SEARCH_STEP)), (column) => ({
      x: column * SEARCH_STEP - MAT.width / 2,
      z: row * SEARCH_STEP - MAT.depth / 2,
    }))
);

/**
 * The resting places of one region at a spacing. Of the points of the mat
 * inside the region and clear of the tubes, the one nearest the region's own
 * middle comes first, then each point nearest the middle that keeps the
 * spacing from every place already taken, so a small region still holds as
 * many objects as fit.
 */
export function regionSpots(
  region: number,
  centres: readonly Place[],
  spacing: number
): readonly Place[] {
  const reserved = [UNIVERSE_PLACE, ...letterPlaces(centres)];
  const inside = Arr.filter(
    SEARCH,
    (place) =>
      regionAt(place, centres) === region && clear(place, centres, reserved)
  );
  const middle = {
    x: Arr.reduce(inside, 0, (sum, spot) => sum + spot.x) / inside.length,
    z: Arr.reduce(inside, 0, (sum, spot) => sum + spot.z) / inside.length,
  };
  const nearestFirst = Arr.sort(
    inside,
    Order.mapInput(Order.Number, (spot: Place) =>
      Math.hypot(spot.x - middle.x, spot.z - middle.z)
    )
  );
  return Arr.reduce(nearestFirst, Arr.empty<Place>(), (taken, spot) =>
    Arr.every(
      taken,
      (other) => Math.hypot(spot.x - other.x, spot.z - other.z) >= spacing
    )
      ? Arr.append(taken, spot)
      : taken
  );
}

/** The closer spacings a crowded region tries, down to three quarters of the usual. */
const TIGHTER = [0.95, 0.9, 0.85, 0.8, 0.75] as const;

/** The places of a region that hold `count` objects, packed closer when the usual spacing is too wide. */
function spotsFor(region: number, count: number, centres: readonly Place[]) {
  return Arr.reduce(
    TIGHTER,
    regionSpots(region, centres, SPACING),
    (found, scale) =>
      found.length >= count
        ? found
        : regionSpots(region, centres, SPACING * scale)
  );
}

/**
 * Where each object rests: the objects of one region take that region's
 * places in order. A region with more objects than places at the usual
 * spacing packs them closer.
 */
export function restingPlaces(
  regions: readonly number[],
  centres: readonly Place[]
): readonly Place[] {
  const members = Arr.map(regions, (region, index) => ({ index, region }));
  const placed = Arr.flatMap(Arr.dedupe(regions), (region) => {
    const crowd = Arr.filter(members, (member) => member.region === region);
    const places = spotsFor(region, crowd.length, centres);
    return Arr.map(crowd, (member, order) => ({
      index: member.index,
      place: Arr.getUnsafe(places, Math.min(order, places.length - 1)),
    }));
  });
  return Arr.map(
    Arr.sort(
      placed,
      Order.mapInput(
        Order.Number,
        (each: { readonly index: number }) => each.index
      )
    ),
    (each) => each.place
  );
}

/** Where each object waits on the tray before sorting: rows of five, front row last. */
export function trayPlaces(count: number): readonly Place[] {
  const columns = 5;
  const rows = Math.ceil(count / columns);
  return Arr.makeBy(count, (index) => ({
    x: ((index % columns) - (columns - 1) / 2) * SPACING * 1.1,
    z: TRAY_Z + (Math.floor(index / columns) - (rows - 1) / 2) * SPACING,
  }));
}
