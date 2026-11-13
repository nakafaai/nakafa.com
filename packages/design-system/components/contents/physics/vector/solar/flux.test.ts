import { describe, expect, it } from "@effect/vitest";
import {
  PanelSchema,
  panelPower,
} from "@repo/design-system/components/contents/physics/vector/solar/flux";
import { Schema } from "effect";

const panel = Schema.decodeUnknownSync(PanelSchema)({
  area: 1.7,
  elevation: 60,
  sunlight: 1000,
});

describe("panelPower", () => {
  it("catches the full 1700 W when tilted 30° to face a sun 60° up", () => {
    const caught = panelPower(panel, 30);
    expect(caught.between).toBe(0);
    expect(caught.power).toBeCloseTo(1700, 10);
  });

  it("catches 1700 cos 30° = 1472 W lying flat", () => {
    const caught = panelPower(panel, 0);
    expect(caught.between).toBe(30);
    expect(caught.cosine).toBeCloseTo(Math.sqrt(3) / 2, 10);
    expect(caught.power).toBeCloseTo(1472.2, 1);
  });

  it("catches nothing once the sun is behind the panel", () => {
    const low = Schema.decodeUnknownSync(PanelSchema)({
      area: 1.7,
      elevation: 0,
      sunlight: 1000,
    });
    expect(panelPower(low, 0).power).toBeCloseTo(0, 8);
    expect(panelPower({ ...low, elevation: 0 }, -10).power).toBe(0);
  });
});
