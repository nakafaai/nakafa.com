// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CARD,
  cardOf,
} from "@repo/design-system/components/three/apparatus/card";

describe("a burette reader card", () => {
  const card = cardOf(0.48, 0.0065);

  it("puts the top of its black band just under the meniscus", () => {
    expect(card.band + CARD.band / 2).toBeCloseTo(0.48 - CARD.below, 9);
  });

  it("holds the whole band on the card, with white above it", () => {
    expect(card.band - CARD.band / 2).toBeGreaterThan(
      card.middle - CARD.height / 2
    );
    expect(card.middle + CARD.height / 2).toBeGreaterThan(
      card.band + CARD.band / 2 + 0.01
    );
  });

  it("stands behind the burette's wall, clear of the glass", () => {
    expect(card.back).toBeLessThan(-0.0065 - CARD.clear);
  });
});
