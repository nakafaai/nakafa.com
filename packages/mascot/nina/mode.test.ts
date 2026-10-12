import { describe, expect, it } from "@effect/vitest";
import { homeOf, modeOf } from "@repo/mascot/nina/mode";

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
