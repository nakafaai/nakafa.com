import { Array as Arr, Schema } from "effect";

/**
 * The objects on the mat, what each of them is, and which objects an
 * operation on sets selects. A set on the mat gathers every object with one
 * attribute, so an object's region is the sets it belongs to, written as one
 * bit per set: bit 0 for A, bit 1 for B, bit 2 for C.
 */

/** What a set can gather the objects by: a colour, a material, being a ball, or being a fruit. */
const VennAttributeSchema = Schema.Literals([
  "red",
  "yellow",
  "blue",
  "green",
  "metal",
  "wood",
  "plastic",
  "ball",
  "fruit",
]);
export type VennAttribute = typeof VennAttributeSchema.Type;

/** The everyday objects the lab can lay out on the mat. */
export const VennObjectSchema = Schema.Literals([
  "apple",
  "lemon",
  "lime",
  "tennis-ball",
  "steel-ball",
  "red-ball",
  "blue-ball",
  "washer",
  "coin",
  "toy-car",
  "red-block",
  "green-block",
  "yellow-block",
  "blue-cup",
  "green-cup",
]);
export type VennObject = typeof VennObjectSchema.Type;

/** What each object is: the one to three attributes a set can gather it by. */
export const OBJECT_ATTRIBUTES: Readonly<
  Record<VennObject, readonly VennAttribute[]>
> = {
  apple: ["red", "fruit"],
  "blue-ball": ["blue", "plastic", "ball"],
  "blue-cup": ["blue", "plastic"],
  coin: ["metal"],
  "green-block": ["green", "wood"],
  "green-cup": ["green", "plastic"],
  lemon: ["yellow", "fruit"],
  lime: ["green", "fruit"],
  "red-ball": ["red", "plastic", "ball"],
  "red-block": ["red", "wood"],
  "steel-ball": ["metal", "ball"],
  "tennis-ball": ["yellow", "ball"],
  "toy-car": ["red", "metal"],
  washer: ["metal"],
  "yellow-block": ["yellow", "wood"],
};

/** The operations on two or three sets the toolbar can offer. */
export const VennOperationSchema = Schema.Literals([
  "intersection",
  "union",
  "complement",
  "outside-union",
  "difference",
  "triple-intersection",
  "union-with-pair",
]);
export type VennOperation = typeof VennOperationSchema.Type;

/** Each operation as KaTeX, in the notation of the KSSM textbook. */
export const OPERATION_MATH: Readonly<Record<VennOperation, string>> = {
  complement: "A'",
  difference: "A \\cap B'",
  intersection: "A \\cap B",
  "outside-union": "(A \\cup B)'",
  "triple-intersection": "A \\cap B \\cap C",
  union: "A \\cup B",
  "union-with-pair": "A \\cup (B \\cap C)",
};

/** Each operation as plain text, for the name a screen reader announces. */
export const OPERATION_TEXT: Readonly<Record<VennOperation, string>> = {
  complement: "A'",
  difference: "A ∩ B'",
  intersection: "A ∩ B",
  "outside-union": "(A ∪ B)'",
  "triple-intersection": "A ∩ B ∩ C",
  union: "A ∪ B",
  "union-with-pair": "A ∪ (B ∩ C)",
};

/** The region of an object: one bit for each set whose attribute it has. */
export function regionOf(
  object: VennObject,
  sets: readonly VennAttribute[]
): number {
  return Arr.reduce(sets, 0, (region, attribute, index) =>
    Arr.contains(OBJECT_ATTRIBUTES[object], attribute)
      ? region + 2 ** index
      : region
  );
}

/** Whether a region lies in set A, B or C, by the set's place on the mat. */
function inSet(region: number, set: 0 | 1 | 2) {
  return Math.floor(region / 2 ** set) % 2 === 1;
}

/** What each operation keeps, given whether a region lies in A, in B and in C. */
const RULES: Readonly<
  Record<VennOperation, (a: boolean, b: boolean, c: boolean) => boolean>
> = {
  complement: (a) => !a,
  difference: (a, b) => a && !b,
  intersection: (a, b) => a && b,
  "outside-union": (a, b) => !(a || b),
  "triple-intersection": (a, b, c) => a && b && c,
  union: (a, b) => a || b,
  "union-with-pair": (a, b, c) => a || (b && c),
};

/** Whether an operation selects the objects of one region. */
export function selects(operation: VennOperation, region: number) {
  return RULES[operation](inSet(region, 0), inSet(region, 1), inSet(region, 2));
}
