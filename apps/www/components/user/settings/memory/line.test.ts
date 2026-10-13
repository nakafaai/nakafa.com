import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { factsLine } from "@/components/user/settings/memory/line";

describe("factsLine", () => {
  it("says who wrote a memory and when it was confirmed", () => {
    expect(
      factsLine({
        confirmed: "2 days ago",
        ends: Option.none(),
        origin: "Saved by Nina",
      })
    ).toBe("Saved by Nina · 2 days ago");
  });

  it("says the end of a situation first, so that a line cut at its end keeps it", () => {
    expect(
      factsLine({
        confirmed: "2 days ago",
        ends: Option.some("Ends 20 October 2026"),
        origin: "Saved by Nina",
      })
    ).toBe("Ends 20 October 2026 · Saved by Nina · 2 days ago");
  });
});
