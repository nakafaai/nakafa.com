// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { focusOf } from "@repo/design-system/components/contents/biology/bone/model";

describe("bone health lab model", () => {
  it("maps every skeletal condition to its primary diagnostic tissue focus", () => {
    expect(focusOf("osteoporosis").part).toBe("spongy");
    expect(focusOf("osteomalacia").part).toBe("mineral");
    expect(focusOf("rickets").part).toBe("growth");
    expect(focusOf("arthritis").part).toBe("cartilage");
    expect(focusOf("scoliosis").part).toBe("spine");
    expect(focusOf("scoliosis").y).toBeGreaterThan(focusOf("rickets").y);
  });
});
