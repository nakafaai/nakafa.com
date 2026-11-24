import { Array as Arr, Option, Schema } from "effect";

/**
 * Every piece of equipment the laboratory corner holds, in the order of the
 * Visual Catalog's closed list: apparatus on the bench, personal protective
 * equipment on its hook and the bench, and safety equipment on the wall.
 */
const EquipmentSchema = Schema.Literals([
  "beaker",
  "conicalFlask",
  "measuringCylinder",
  "testTube",
  "boilingTube",
  "dropper",
  "petriDish",
  "inoculatingLoop",
  "bunsenBurner",
  "tripod",
  "forceps",
  "scalpel",
  "mountedNeedle",
  "microscope",
  "slide",
  "labCoat",
  "goggles",
  "gloves",
  "mask",
  "extinguisher",
  "fireBlanket",
  "eyewash",
  "firstAid",
  "fumeChamber",
]);
export type Equipment = typeof EquipmentSchema.Type;

/** Whether a value names an item of the corner, as the scene tags each pickable part. */
export const isEquipment = Schema.is(EquipmentSchema);

/** The three groups a school laboratory sorts its equipment into, in the order the card lists them. */
const CategorySchema = Schema.Literals(["apparatus", "protective", "safety"]);
export type Category = typeof CategorySchema.Type;

/** The groups in the order the card lists them. */
const CATEGORIES = CategorySchema.literals;

/** A point or a size in the room, in metres: x to the right, y up from the floor, z towards the reader. */
export const TripleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Triple = typeof TripleSchema.Type;

/**
 * Where one item stands and how big it is: its group, the middle of its foot
 * (where it rests on the bench, the floor or its hook), its real width,
 * height and depth, and the direction the camera looks at it from.
 */
const PlaceSchema = Schema.Struct({
  base: TripleSchema,
  category: CategorySchema,
  size: TripleSchema,
  view: TripleSchema,
});
type Place = typeof PlaceSchema.Type;

/**
 * The height of the bench top above the floor: the standing height EN 13150
 * gives for laboratory workbenches in secondary schools (850 or 900 mm).
 *
 * @see https://standards.iteh.ai/catalog/standards/cen/01e1ee23-cab0-4826-9529-1ed405408a5b/en-13150-2001
 */
export const BENCH_TOP = 0.9;

/** The room's walls: the back wall behind the bench and the side wall at its left end, their inner faces in metres. */
export const WALLS = { back: -0.75, side: -1.6 } as const;

/** The bench along the back wall, from the side wall to its right end, and its front edge, in metres. */
export const BENCH = { front: 0, right: 0.6 } as const;

/** Looks at the bench from above and in front. */
const FROM_FRONT: Triple = [0.45, 0.85, 1];

/** Looks at a tall item on the bench nearly level, as a learner standing at the bench does. */
const FROM_STANDING: Triple = [0.5, 0.5, 1];

/** Looks at the side wall from the room. */
const FROM_ROOM: Triple = [1, 0.3, 0.45];

/**
 * Every item's place, at real size. Glassware follows the makers' sizes for
 * ISO-compliant ware: a 250 mL low-form beaker is 70 mm across and 95 mm tall
 * (Duran, ISO 3819), a 100 mL measuring cylinder 256 mm tall on a hexagonal
 * foot about 75 mm across (Duran, ISO 4788), a test tube 16 by 150 mm and a
 * boiling tube 25 by 150 mm (ISO 4142), a Petri dish 90 by 15 mm, a glass
 * slide 76 by 26 mm (ISO 8037-1) and a disposable loop 200 mm long. A Bunsen
 * burner is about 130 mm tall on an 85 mm foot, a tripod 220 mm tall under a
 * 150 mm square gauze, and a school microscope about 360 mm tall. On the wall,
 * a 2 kg carbon dioxide extinguisher is 575 by 104 mm with its handle near
 * 1 m (BS 5306-8 for heavier extinguishers), a fire blanket's case 255 by 160
 * by 55 mm, and the eyewash's nozzles 1.02 m above the floor, inside the 0.84
 * to 1.35 m ANSI Z358.1 asks for. A face mask is 175 by 95 mm (EN 14683).
 *
 * @see https://www.carlroth.com/com/en/beakers/beaker-duran-low-form/p/c114.1
 * @see https://www.dwk.com/na/duran-measuring-cylinder-with-hexagonal-base-class-a-100-ml-213902402
 * @see https://cdn.standards.iteh.ai/samples/9902/f267964fb7944ff7b308582bf134a310/ISO-4142-1997.pdf
 * @see https://www.flinnsci.com/catalogs/Flinn_US_2022pdf/page_143.html
 * @see https://www.dwk.com/na/microscope-slides-from-soda-lime-glass-ground-edges-45-235501309
 * @see https://shop.gbo.com/en/row/products/0110/0110_0100/0110_0100_0020/731175.html
 * @see https://www.fishersci.com/us/en/browse/90088067/mecheros-de-gas
 * @see https://www.thgeyer.com/lab/shop/labware/general-laboratory-consumables/heating/tripod
 * @see https://select.schoolspecialty.com/frey-scientific-student-microscope-monocular-head-2137057
 * @see https://www.toolstation.com/firechief-cxc2s-co2-fire-extinguisher/pAF057
 * @see https://safelincs.co.uk/fire-extinguishers-and-equipment-faqs/179/what-height-should-extinguishers-be-installed-at
 * @see https://www.cromwell.co.uk/shop/site-safety/fire-blankets/fire-blanket-fibreglass-1-2m-x-1-2m/p/MYR9943722F
 * @see https://blog.ansi.org/ansi/ansi-z358-1-emergency-eyewash-station-shower/
 * @see https://www.medicalexpo.com/prod/tecman-advanced-healthcare-products/product-129010-997484.html
 */
export const PLACES = {
  beaker: {
    base: [-0.3, BENCH_TOP, -0.38],
    category: "apparatus",
    size: [0.07, 0.095, 0.07],
    view: FROM_STANDING,
  },
  conicalFlask: {
    base: [-0.19, BENCH_TOP, -0.56],
    category: "apparatus",
    size: [0.086, 0.147, 0.086],
    view: FROM_STANDING,
  },
  measuringCylinder: {
    base: [-0.33, BENCH_TOP, -0.6],
    category: "apparatus",
    size: [0.075, 0.256, 0.075],
    view: FROM_STANDING,
  },
  testTube: {
    base: [-0.214, BENCH_TOP + 0.008, -0.16],
    category: "apparatus",
    size: [0.016, 0.15, 0.016],
    view: FROM_STANDING,
  },
  boilingTube: {
    base: [-0.106, BENCH_TOP + 0.008, -0.16],
    category: "apparatus",
    size: [0.025, 0.15, 0.025],
    view: FROM_STANDING,
  },
  dropper: {
    base: [-0.17, BENCH_TOP, -0.06],
    category: "apparatus",
    size: [0.1, 0.016, 0.016],
    view: FROM_FRONT,
  },
  petriDish: {
    base: [0.08, BENCH_TOP, -0.14],
    category: "apparatus",
    size: [0.09, 0.015, 0.09],
    view: FROM_FRONT,
  },
  inoculatingLoop: {
    base: [0.165, BENCH_TOP, -0.15],
    category: "apparatus",
    size: [0.012, 0.006, 0.2],
    view: FROM_FRONT,
  },
  bunsenBurner: {
    base: [0.12, BENCH_TOP + 0.006, -0.42],
    category: "apparatus",
    size: [0.085, 0.13, 0.085],
    view: FROM_STANDING,
  },
  tripod: {
    base: [0.12, BENCH_TOP + 0.006, -0.42],
    category: "apparatus",
    size: [0.2, 0.22, 0.2],
    view: FROM_STANDING,
  },
  forceps: {
    base: [0.268, BENCH_TOP + 0.006, -0.15],
    category: "apparatus",
    size: [0.012, 0.008, 0.12],
    view: FROM_FRONT,
  },
  scalpel: {
    base: [0.3, BENCH_TOP + 0.006, -0.15],
    category: "apparatus",
    size: [0.012, 0.006, 0.15],
    view: FROM_FRONT,
  },
  mountedNeedle: {
    base: [0.332, BENCH_TOP + 0.006, -0.15],
    category: "apparatus",
    size: [0.012, 0.012, 0.14],
    view: FROM_FRONT,
  },
  microscope: {
    base: [0.46, BENCH_TOP, -0.47],
    category: "apparatus",
    size: [0.15, 0.36, 0.22],
    view: FROM_STANDING,
  },
  slide: {
    base: [0.47, BENCH_TOP, -0.17],
    category: "apparatus",
    size: [0.076, 0.002, 0.026],
    view: FROM_FRONT,
  },
  labCoat: {
    base: [-1.545, 0.8, 0.35],
    category: "protective",
    size: [0.11, 0.98, 0.52],
    view: FROM_ROOM,
  },
  goggles: {
    base: [-1.565, 1.56, 0.78],
    category: "protective",
    size: [0.07, 0.07, 0.17],
    view: FROM_ROOM,
  },
  gloves: {
    base: [-0.62, BENCH_TOP, -0.6],
    category: "protective",
    size: [0.24, 0.065, 0.125],
    view: FROM_FRONT,
  },
  mask: {
    base: [-0.6, BENCH_TOP, -0.2],
    category: "protective",
    size: [0.175, 0.012, 0.095],
    view: FROM_FRONT,
  },
  extinguisher: {
    base: [-1.528, 0.43, 1.82],
    category: "safety",
    size: [0.104, 0.575, 0.104],
    view: FROM_ROOM,
  },
  fireBlanket: {
    base: [-1.572, 1.4, 1.46],
    category: "safety",
    size: [0.055, 0.255, 0.16],
    view: FROM_ROOM,
  },
  eyewash: {
    base: [-0.92, BENCH_TOP, -0.6],
    category: "safety",
    size: [0.06, 0.12, 0.2],
    view: FROM_FRONT,
  },
  firstAid: {
    base: [-1.55, 1.38, 1.1],
    category: "safety",
    size: [0.1, 0.25, 0.3],
    view: FROM_ROOM,
  },
  fumeChamber: {
    base: [1.23, 0, -0.35],
    category: "safety",
    size: [1.1, 2.4, 0.8],
    view: [0.15, 0.25, 1],
  },
} as const satisfies Readonly<Record<Equipment, Place>>;

/** The group one item belongs to. */
export function categoryOf(item: Equipment) {
  return PLACES[item].category;
}

/** The groups the picked items fall into, in the card's order, each once. */
export function categoriesOf(items: readonly Equipment[]) {
  return Arr.filter(CATEGORIES, (category) =>
    Arr.some(items, (item) => categoryOf(item) === category)
  );
}

/** The picked items of one group, in the order the lesson picked them. */
export function itemsIn(items: readonly Equipment[], category: Category) {
  return Arr.filter(items, (item) => categoryOf(item) === category);
}

/** The first picked item of one group, which the card shows when the learner turns to that group. */
export function firstIn(
  items: readonly [Equipment, ...Equipment[]],
  category: Category
) {
  return Option.getOrElse(
    Arr.findFirst(items, (item) => categoryOf(item) === category),
    () => items[0]
  );
}

/** The item after `current` in the lesson's order, back to the first after the last, for the card's tour. */
export function nextItem(
  items: readonly [Equipment, ...Equipment[]],
  current: Equipment
) {
  const index = Option.getOrElse(
    Arr.findFirstIndex(items, (item) => item === current),
    () => -1
  );
  return Option.getOrElse(Arr.get(items, index + 1), () => items[0]);
}
