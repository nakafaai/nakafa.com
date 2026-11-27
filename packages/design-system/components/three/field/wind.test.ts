import { describe, expect, it } from "@effect/vitest";
import {
  WIND_HEADING,
  WIND_SHADER,
  windAt,
} from "@repo/design-system/components/three/field/wind";
import { Array as Arr } from "effect";

describe("windAt", () => {
  it("stays between a lull and a full gust everywhere and always", () => {
    for (let step = 0; step < 400; step += 1) {
      const push = windAt(step * 0.37 - 60, step * -0.21 + 40, step * 0.113);
      expect(push).toBeGreaterThan(0.17);
      expect(push).toBeLessThanOrEqual(1);
    }
  });

  it("answers the same push for the same place and moment", () => {
    expect(windAt(3.2, -7.5, 12.4)).toBe(windAt(3.2, -7.5, 12.4));
  });

  it("rises and falls as a gust passes one place", () => {
    const pushes = Arr.makeBy(80, (step) => windAt(1, 2, step * 0.1));
    expect(Math.max(...pushes) - Math.min(...pushes)).toBeGreaterThan(0.3);
  });

  it("pushes neighbours alike and distant places differently", () => {
    const here = windAt(4, 4, 5);
    expect(Math.abs(windAt(4.02, 4.02, 5) - here)).toBeLessThan(0.05);
    const far = Arr.makeBy(40, (step) =>
      windAt(4 + step * 1.3, 4 + step * 0.7, 5)
    );
    expect(Math.max(...far) - Math.min(...far)).toBeGreaterThan(0.3);
  });
});

describe("WIND_SHADER", () => {
  it("blows along a unit heading and declares the wind a shader reads", () => {
    expect(Math.hypot(...WIND_HEADING)).toBeCloseTo(1, 6);
    expect(WIND_SHADER).toContain(
      "const vec2 WIND_HEADING = vec2(0.8000, 0.6000);"
    );
    expect(WIND_SHADER).toContain("float windAt(vec2 place, float time)");
    expect(WIND_SHADER).toContain(
      "1.7000 * sin(across * 0.1300 + time * 0.2100)"
    );
  });
});
