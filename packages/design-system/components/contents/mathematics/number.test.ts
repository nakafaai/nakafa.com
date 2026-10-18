// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";

describe("mathematical numbers", () => {
  it("writes a decimal comma as {,} and keeps a decimal point", () => {
    expect(mathNumber("2,5")).toBe("2{,}5");
    expect(mathNumber("2.5")).toBe("2.5");
  });
});
