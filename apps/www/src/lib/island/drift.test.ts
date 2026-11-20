// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { shedOf } from "@/lib/island/drift";
import { colorOf } from "@/lib/island/palette";

describe("island/drift", () => {
  it("sheds most in autumn in its orange, blossom in spring, and nothing in winter", () => {
    const autumn = shedOf("autumn");
    const spring = shedOf("spring");
    expect(autumn.share).toBeGreaterThan(spring.share);
    expect(shedOf("winter").share).toBe(0);
    expect(spring.color).toEqual([240 / 255, 166 / 255, 191 / 255]);
    expect(shedOf("summer").color).toEqual(
      Arr.map(colorOf("leaf", 2), (channel) => channel / 255)
    );
  });
});
