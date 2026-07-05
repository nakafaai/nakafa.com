import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { describe, expect, it } from "vitest";

describe("Nakafa agent route formatting", () => {
  it("formats route titles for agent summaries", () => {
    expect(
      formatNakafaRouteTitle(
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1"
      )
    ).toBe("Tryout / Indonesia / Snbt / General Reasoning / Set 1");
  });

  it("falls back to readable route segments for non-material routes", () => {
    expect(formatNakafaRouteTitle("articles/math/rational-functions")).toBe(
      "Math / Rational Functions"
    );
  });

  it("falls back when a route uses unknown metadata", () => {
    expect(
      formatNakafaRouteTitle(
        "question-bank/tryout/indonesia/unknown/general-reasoning/set-1"
      )
    ).toBe("Tryout / Indonesia / Unknown / General Reasoning / Set 1");
  });
});
