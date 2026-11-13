import { describe, expect, it } from "@effect/vitest";
import {
  ropeForces,
  TeamsSchema,
} from "@repo/design-system/components/contents/physics/vector/tug/rope";
import { Schema } from "effect";

const decode = Schema.decodeSync(TeamsSchema);

describe("ropeForces", () => {
  it("pulls 3 times 400 N left against 4 times 400 N right, 400 N net to the right", () => {
    expect(ropeForces(decode({ left: 3, pull: 400, right: 4 }))).toEqual({
      left: -1200,
      net: 400,
      right: 1600,
    });
  });

  it("gives the zero vector for matched teams", () => {
    expect(ropeForces(decode({ left: 5, pull: 400, right: 5 })).net).toBe(0);
  });

  it("refuses a team of more than eight or of part of a person", () => {
    const check = Schema.decodeExit(TeamsSchema);
    expect(check({ left: 9, pull: 400, right: 1 })._tag).toBe("Failure");
    expect(check({ left: 1.5, pull: 400, right: 1 })._tag).toBe("Failure");
  });
});
