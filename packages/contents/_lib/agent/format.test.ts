import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { describe, expect, it } from "vitest";

describe("Nakafa agent route formatting", () => {
  it("formats route titles for agent summaries", () => {
    expect(
      formatNakafaRouteTitle(
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1"
      )
    ).toBe("SNBT General Reasoning Try Out 2026 Set 1");
  });

  it("falls back to readable route segments for non-exercise routes", () => {
    expect(formatNakafaRouteTitle("articles/math/rational-functions")).toBe(
      "Math / Rational Functions"
    );
  });

  it("falls back when an exercise route uses unknown metadata", () => {
    expect(
      formatNakafaRouteTitle(
        "exercises/high-school/unknown/general-reasoning/try-out/2026/set-1"
      )
    ).toBe(
      "High School / Unknown / General Reasoning / Try Out / 2026 / Set 1"
    );
  });
});
