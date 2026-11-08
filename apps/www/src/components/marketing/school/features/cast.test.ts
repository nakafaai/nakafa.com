import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  DEMO_ASKER,
  DEMO_CHILD,
  DEMO_COHORTS,
  DEMO_REPLIERS,
  DEMO_REPORTED,
  DEMO_TEACHER,
  SCHOOL_TOY_HERD,
} from "@/components/marketing/school/features/cast";

/** The animal of every person and every face the landing's demos show. */
const PEOPLE = Arr.map(
  [
    DEMO_TEACHER.mascot,
    DEMO_ASKER.mascot,
    ...DEMO_REPLIERS,
    DEMO_REPORTED.mascot,
    ...Arr.flatten(DEMO_COHORTS),
    DEMO_CHILD.mascot,
  ],
  (mascot) => mascot.animal
);

describe("the people of the School landing", () => {
  it("give every person and every face on the page an animal no one else has", () => {
    expect(PEOPLE).toHaveLength(16);
    expect(Arr.dedupe(PEOPLE)).toHaveLength(16);
  });

  it("give the toys sixteen more animals that none of the people has", () => {
    const toys = Arr.map(SCHOOL_TOY_HERD, (mascot) => mascot.animal);
    expect(toys).toHaveLength(16);
    expect(Arr.dedupe([...PEOPLE, ...toys])).toHaveLength(32);
  });
});
