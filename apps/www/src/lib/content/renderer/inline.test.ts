import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { inlinePieces } from "@/lib/content/renderer/inline";

describe("inlinePieces", () => {
  it("splits text and formulas, mhchem included", () => {
    expect(inlinePieces("$\\ce{2H2(g) + O2(g) -> 2H2O(g)}$ in a closed flask")).toStrictEqual(
      Option.some([
        { kind: "math", math: "\\ce{2H2(g) + O2(g) -> 2H2O(g)}" },
        { kind: "text", text: " in a closed flask" },
      ])
    );
    expect(inlinePieces("Speed $v$ and time $t$")).toStrictEqual(
      Option.some([
        { kind: "text", text: "Speed " },
        { kind: "math", math: "v" },
        { kind: "text", text: " and time " },
        { kind: "math", math: "t" },
      ])
    );
  });

  it("leaves prices, escaped dollars and loose signs as plain text", () => {
    expect(Option.isNone(inlinePieces("Costs $5 and $10"))).toBe(true);
    expect(Option.isNone(inlinePieces("A plain title"))).toBe(true);
    expect(Option.isNone(inlinePieces("\\$x\\$ stays text"))).toBe(true);
    expect(inlinePieces("Pay \\$5 for $x$")).toStrictEqual(
      Option.some([
        { kind: "text", text: "Pay $5 for " },
        { kind: "math", math: "x" },
      ])
    );
  });
});
