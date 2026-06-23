import { addPlaneCoefficient } from "@repo/math/schema/coordinate/coefficient";
import { describe, expect, it } from "vitest";

describe("coordinate plane coefficient arithmetic", () => {
  it("rejects nonfinite coefficient sums", () => {
    expect(
      addPlaneCoefficient(Number.MAX_VALUE, Number.MAX_VALUE)
    ).toBeUndefined();
  });
});
