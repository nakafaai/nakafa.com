// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { vertebraSpecOf } from "@repo/design-system/components/contents/biology/vertebra/model";

describe("vertebra lab model", () => {
  it("encodes exact counts, fusion flags, and progressive body thickening down the spine", () => {
    expect(vertebraSpecOf("cervical").count).toBe(7);
    expect(vertebraSpecOf("atlas").hasBody).toBe(false);
    expect(vertebraSpecOf("axis").hasDens).toBe(true);
    expect(vertebraSpecOf("thoracic")).toMatchObject({
      count: 12,
      fused: false,
      hasFacet: true,
    });
    expect(vertebraSpecOf("lumbar").bodyRadius).toBeGreaterThan(
      vertebraSpecOf("cervical").bodyRadius
    );
    expect(vertebraSpecOf("sacral")).toMatchObject({ count: 5, fused: true });
    expect(vertebraSpecOf("caudal")).toMatchObject({ count: 4, fused: true });
  });
});
