import { cast } from "@repo/mascot/seed";
import { Array as Arr } from "effect";

/** The seed that names the animals of the School landing. */
const SCHOOL_SEED = "nakafa-school";

/** How many people the landing's demos show, each with an animal of their own. */
const SCHOOL_PEOPLE = 21;

/** The animals of the School landing, from one cast, so no animal appears twice on the page. */
const SCHOOL_CAST = cast(SCHOOL_SEED, SCHOOL_PEOPLE);

/** One person of a demo: their name and the animal at their place in the cast. */
function person(name: string, place: number) {
  return { mascot: Arr.getUnsafe(SCHOOL_CAST, place), name };
}

/** The teacher of the demo class, who answers in its forum. */
export const DEMO_TEACHER = person("Rina", 0);

/** The student who asks in the forum. */
export const DEMO_ASKER = person("Dimas", 1);

/** The animals of the forum thread's replies, shown together. */
export const DEMO_REPLIERS = Arr.take(Arr.drop(SCHOOL_CAST, 2), 3);

/** The students whose hand-ins the task shows. */
export const DEMO_HANDERS = [
  person("Nadia", 5),
  person("Raka", 6),
  person("Fajar", 7),
] as const;

/** The student whose report card the school signs. */
export const DEMO_REPORTED = person("Sari", 8);

/** The students that insight shows as needing help. */
export const DEMO_STRUGGLING = [
  person("Bima", 9),
  person("Citra", 10),
] as const;

/** The animals of each cohort that moves up a grade, three of them each. */
export const DEMO_COHORTS = Arr.map([11, 14, 17], (start) =>
  Arr.take(Arr.drop(SCHOOL_CAST, start), 3)
);

/** The child whose parent follows the school. */
export const DEMO_CHILD = person("Ayu", 20);
