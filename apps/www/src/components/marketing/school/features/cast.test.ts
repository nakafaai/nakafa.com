import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  DEMO_CHILD,
  DEMO_CLASS,
  DEMO_LEARNERS,
  DEMO_REPORTED,
  SCHOOL_TOY_HERD,
} from "@/components/marketing/school/features/cast";

/** The animal of every person and every face the landing's pictures show. */
const PEOPLE = Arr.map(
  [...DEMO_CLASS, ...DEMO_LEARNERS, DEMO_REPORTED.mascot, DEMO_CHILD.mascot],
  (mascot) => mascot.animal
);

describe("the people of the School landing", () => {
  it("give every person and every face on the page an animal no one else has", () => {
    expect(PEOPLE).toHaveLength(10);
    expect(Arr.dedupe(PEOPLE)).toHaveLength(10);
  });

  it("give the toys twenty-four more animals that none of the people has", () => {
    const toys = Arr.map(SCHOOL_TOY_HERD, (mascot) => mascot.animal);
    expect(toys).toHaveLength(24);
    expect(Arr.dedupe([...PEOPLE, ...toys])).toHaveLength(34);
  });
});
