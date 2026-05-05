import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { describe, expect, it } from "vitest";

describe("Nakafa agent route formatting", () => {
  it("formats route titles for agent summaries", () => {
    expect(
      formatNakafaRouteTitle(
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1"
      )
    ).toBe("High School / Snbt / General Reasoning / Try Out / 2026 / Set 1");
  });
});
