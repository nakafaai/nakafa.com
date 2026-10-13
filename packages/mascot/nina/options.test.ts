import { describe, expect, it } from "@effect/vitest";
import { ActSchema } from "@repo/mascot/nina/act";
import { EdgeSchema } from "@repo/mascot/nina/edge";
import { BEHAVIORS, homeOf, modeOf, moodOf } from "@repo/mascot/nina/options";
import { type Pose, REST } from "@repo/mascot/nina/pose";
import { Array as Arr, Record as Rec } from "effect";

/** A pose of an act that has a face of its own. */
const HAPPY: Pose = { ...REST, mood: "happy" };

describe("the way she is shown", () => {
  it("shows all of her, her arms over an edge, or her face in a tile", () => {
    expect(modeOf({ whole: true })).toBe("whole");
    expect(modeOf({ lean: "peek" })).toBe("peek");
    expect(modeOf({ lean: "right" })).toBe("tile");
    expect(modeOf({})).toBe("tile");
  });

  it("goes back to the act that she is given, or to the one that suits how she is shown", () => {
    expect(homeOf({ act: "reading", whole: true })).toBe("reading");
    expect(homeOf({ whole: true })).toBe("relaxed");
    expect(homeOf({ act: "greeting", lean: "peek" })).toBe("greeting");
    expect(homeOf({ lean: "peek" })).toBe("gripping");
  });
});

describe("every act she does", () => {
  it("has no name that is both a whole act and an act over an edge, for one would hide the other", () => {
    expect(Arr.intersection(ActSchema.literals, EdgeSchema.literals)).toEqual(
      []
    );
    expect(Rec.keys(BEHAVIORS)).toHaveLength(
      ActSchema.literals.length + EdgeSchema.literals.length
    );
  });
});

describe("the face she shows", () => {
  it("is the face that a press shows, else the one asked for, else the one her act has, else hello", () => {
    expect(moodOf({ mood: "shy", whole: true }, HAPPY, "proud")).toBe("proud");
    expect(moodOf({ mood: "shy", whole: true }, HAPPY)).toBe("shy");
    expect(moodOf({ whole: true }, HAPPY)).toBe("happy");
    expect(moodOf({ whole: true }, REST)).toBe("hello");
  });

  it("is the face of her act over an edge and in a tile, as it is when all of her shows", () => {
    expect(moodOf({ lean: "peek" }, HAPPY)).toBe("happy");
    expect(moodOf({ lean: "left" }, HAPPY)).toBe("happy");
    expect(moodOf({ lean: "peek", mood: "sad" }, HAPPY)).toBe("sad");
  });
});
