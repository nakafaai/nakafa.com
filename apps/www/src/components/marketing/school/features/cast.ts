import { DESIGNS } from "@repo/mascot/animal";
import { Mascot } from "@repo/mascot/code";
import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the School landing. */
const SCHOOL_SEED = "nakafa-school";

/** How many places of the cast the landing's demos take, each person at a place of their own. */
const SCHOOL_PEOPLE = 10;

/** How many animals the landing's toys take: six around the hero's title, and two where each of its nine later parts begins. */
const SCHOOL_TOYS = 24;

/**
 * The animals of the School landing, from one cast: the people of its demos
 * first, then its toys, so no animal appears twice on the page.
 */
const SCHOOL_CAST = cast(SCHOOL_SEED, SCHOOL_PEOPLE + SCHOOL_TOYS);

/** The animals of the landing's toys, after its people. */
export const SCHOOL_TOY_HERD = Arr.drop(SCHOOL_CAST, SCHOOL_PEOPLE);

/**
 * How many animals the School pricing page takes: two in the top corners of its plans, two where each of its five
 * later parts begins, and one over each plan card that Nina does not stand behind.
 */
const SCHOOL_PRICING_COUNT = 14;

/** The animals of the School pricing page, from a cast of its own, since no person stands on that page. */
export const SCHOOL_PRICING_HERD = cast(
  "nakafa-school-pricing",
  SCHOOL_PRICING_COUNT
);

/** One person of a demo: their name and the animal at their place in the cast. */
function person(name: string, place: number) {
  return { mascot: Arr.getUnsafe(SCHOOL_CAST, place), name };
}

/** The four students of the class that Nina gives a task, in the order they sit. */
export const DEMO_CLASS = Arr.take(SCHOOL_CAST, 4);

/** The four students whose mastery the insight follows. */
export const DEMO_LEARNERS = Arr.take(Arr.drop(SCHOOL_CAST, 4), 4);

/** The student whose report card the school signs. */
export const DEMO_REPORTED = person("Sari", 8);

/** The child whose parent follows the school. */
export const DEMO_CHILD = person("Ayu", 9);

/**
 * The child's parent: the same animal in the next of its palettes, so the two
 * read as one family and still as two people.
 */
export const DEMO_PARENT = Mascot.make({
  ...DEMO_CHILD.mascot,
  eyes: "smile",
  palette:
    (DEMO_CHILD.mascot.palette + 1) %
    DESIGNS[DEMO_CHILD.mascot.animal].colors.length,
});
