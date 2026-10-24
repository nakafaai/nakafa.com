// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { solutionSetMath } from "@repo/design-system/components/contents/mathematics/solution";

const writeNumber = (value: number) => value.toString();

describe("solution sets", () => {
  it("joins the shaded segments with a union and leaves infinite ends open", () => {
    expect(
      solutionSetMath(
        [
          {
            end: -3,
            endInclusive: false,
            shaded: true,
            start: Number.NEGATIVE_INFINITY,
          },
          { end: 2, shaded: false, start: -3 },
          {
            end: Number.POSITIVE_INFINITY,
            shaded: true,
            start: 2,
            startInclusive: false,
          },
        ],
        writeNumber,
        ", "
      )
    ).toBe("(-\\infty, -3) \\cup (2, \\infty)");
  });

  it("closes a finite end where its segment includes the bound", () => {
    expect(
      solutionSetMath(
        [{ end: 4, endInclusive: true, start: 1, startInclusive: true }],
        writeNumber,
        ", "
      )
    ).toBe("[1, 4]");
    expect(
      solutionSetMath(
        [
          {
            end: 2,
            endInclusive: true,
            start: Number.NEGATIVE_INFINITY,
            startInclusive: true,
          },
          {
            end: Number.POSITIVE_INFINITY,
            endInclusive: true,
            start: 5,
            startInclusive: true,
          },
        ],
        writeNumber,
        ", "
      )
    ).toBe("(-\\infty, 2] \\cup [5, \\infty)");
  });

  it("writes a decimal comma inside the bounds and uses the separator of the locale", () => {
    expect(
      solutionSetMath(
        [{ end: 2, start: 0.5 }],
        (value) => value.toString().replace(".", ","),
        "; "
      )
    ).toBe("(0{,}5; 2)");
  });

  it("reads a missing bound as a ray to the edge of the axis", () => {
    expect(
      solutionSetMath(
        [{ end: 2, endInclusive: true, startInclusive: true }],
        writeNumber,
        ", "
      )
    ).toBe("(-\\infty, 2]");
    expect(
      solutionSetMath([{ start: 5, startInclusive: true }], writeNumber, ", ")
    ).toBe("[5, \\infty)");
    expect(solutionSetMath([{}], writeNumber, ", ")).toBe(
      "(-\\infty, \\infty)"
    );
  });

  it("is empty when no segment is shaded", () => {
    expect(
      solutionSetMath([{ end: 1, shaded: false, start: 0 }], writeNumber, ", ")
    ).toBe("\\varnothing");
    expect(solutionSetMath([], writeNumber, ", ")).toBe("\\varnothing");
  });
});
