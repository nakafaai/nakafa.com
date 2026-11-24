import { describe, expect, it } from "@effect/vitest";
import { evaluatePlasmolysis } from "@repo/design-system/components/contents/biology/plasmolysis/model";

describe("plasmolysis cell model", () => {
  it("contrasts plant turgor/plasmolysis against red blood cell haemolysis/crenation", () => {
    expect(evaluatePlasmolysis("plant", "hypotonic").outcome).toBe("turgid");
    expect(evaluatePlasmolysis("plant", "isotonic").outcome).toBe("normal");
    expect(evaluatePlasmolysis("plant", "hypertonic").outcome).toBe(
      "plasmolysed"
    );

    expect(evaluatePlasmolysis("redBlood", "hypotonic").outcome).toBe(
      "haemolysed"
    );
    expect(evaluatePlasmolysis("redBlood", "isotonic").outcome).toBe("normal");
    expect(evaluatePlasmolysis("redBlood", "hypertonic").outcome).toBe(
      "crenated"
    );
  });
});
