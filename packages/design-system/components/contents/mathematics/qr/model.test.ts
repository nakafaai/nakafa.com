import { describe, expect, it } from "@effect/vitest";
import { evaluateQrStep } from "@repo/design-system/components/contents/mathematics/qr/model";

describe("QR Gram-Schmidt 3D model", () => {
  it("reduces orthogonality error to zero across the Gram-Schmidt sequence", () => {
    const s0 = evaluateQrStep("originalBasis", 0.7);
    const s1 = evaluateQrStep("normalizeQ1", 0.7);
    const s2 = evaluateQrStep("orthogonalizeQ2", 0.7);
    const s3 = evaluateQrStep("orthogonalizeQ3", 0.7);

    expect(s0.orthogonalityError).toBeGreaterThan(s1.orthogonalityError);
    expect(s1.orthogonalityError).toBeGreaterThan(s2.orthogonalityError);
    expect(s2.q2TiltRad).toBe(0);
    expect(s3.orthogonalityError).toBe(0);
    expect(s3.q3TiltRad).toBe(0);
  });
});
