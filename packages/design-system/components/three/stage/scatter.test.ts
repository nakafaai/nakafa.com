import { describe, expect, it } from "@effect/vitest";
import { scatterMotes } from "@repo/design-system/components/three/stage/scatter";

describe("scatterMotes", () => {
  it("places every mote inside the ball and outside its hollow middle", () => {
    const { places, traits } = scatterMotes(400, 7, 0.4);
    expect(places).toHaveLength(1200);
    expect(traits).toHaveLength(1600);
    for (let mote = 0; mote < 400; mote += 1) {
      const far = Math.hypot(
        places[mote * 3] ?? 0,
        places[mote * 3 + 1] ?? 0,
        places[mote * 3 + 2] ?? 0
      );
      expect(far).toBeGreaterThanOrEqual(0.4 - 1e-6);
      expect(far).toBeLessThanOrEqual(1 + 1e-6);
    }
    expect(Math.min(...traits)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...traits)).toBeLessThan(1);
  });

  it("spreads motes over every side of the ball", () => {
    const { places } = scatterMotes(600, 3, 0);
    const sides = [0, 0, 0, 0, 0, 0];
    for (let mote = 0; mote < 600; mote += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const side = (places[mote * 3 + axis] ?? 0) < 0 ? 0 : 1;
        sides[axis * 2 + side] = (sides[axis * 2 + side] ?? 0) + 1;
      }
    }
    expect(Math.min(...sides)).toBeGreaterThan(240);
  });

  it("gives the same scatter for one seed and another for another", () => {
    expect(scatterMotes(32, 5, 0.2)).toEqual(scatterMotes(32, 5, 0.2));
    expect(scatterMotes(32, 5, 0.2).places).not.toEqual(
      scatterMotes(32, 6, 0.2).places
    );
  });

  it("keeps most motes small", () => {
    const { traits } = scatterMotes(500, 11, 0);
    let small = 0;
    for (let mote = 0; mote < 500; mote += 1) {
      small += (traits[mote * 4] ?? 0) < 0.25 ? 1 : 0;
    }
    expect(small).toBeGreaterThan(280);
  });
});
