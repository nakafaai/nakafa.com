// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { homeOf, modeOf } from "@repo/design-system/components/nina/mode";

describe("the way she is shown", () => {
  it("shows all of her, her arms over an edge, or her face in a tile", () => {
    expect(modeOf({ whole: true })).toBe("whole");
    expect(modeOf({ lean: "intip" })).toBe("peek");
    expect(modeOf({ lean: "kanan" })).toBe("tile");
    expect(modeOf({})).toBe("tile");
  });

  it("goes back to the act that she is given, or to the one that suits how she is shown", () => {
    expect(homeOf({ act: "membaca", whole: true })).toBe("membaca");
    expect(homeOf({ whole: true })).toBe("santai");
    expect(homeOf({ act: "lambai", lean: "intip" })).toBe("lambai");
    expect(homeOf({ lean: "intip" })).toBe("pegang");
  });
});
