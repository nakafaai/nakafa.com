import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  DEMO_ASKER,
  DEMO_CHILD,
  DEMO_COHORTS,
  DEMO_HANDERS,
  DEMO_REPLIERS,
  DEMO_REPORTED,
  DEMO_STRUGGLING,
  DEMO_TEACHER,
} from "@/components/marketing/school/features/cast";

describe("the people of the School landing", () => {
  it("give every person and every face on the page an animal no one else has", () => {
    const animals = Arr.map(
      [
        DEMO_TEACHER.mascot,
        DEMO_ASKER.mascot,
        ...DEMO_REPLIERS,
        ...Arr.map(DEMO_HANDERS, (person) => person.mascot),
        DEMO_REPORTED.mascot,
        ...Arr.map(DEMO_STRUGGLING, (person) => person.mascot),
        ...Arr.flatten(DEMO_COHORTS),
        DEMO_CHILD.mascot,
      ],
      (mascot) => mascot.animal
    );
    expect(animals).toHaveLength(21);
    expect(Arr.dedupe(animals)).toHaveLength(21);
  });
});
