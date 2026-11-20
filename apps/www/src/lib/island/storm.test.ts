// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { lightOf } from "@/lib/island/sky";
import {
  flashed,
  flashOf,
  lastStrike,
  thundersBetween,
} from "@/lib/island/storm";

/** Every strike of the first ten minutes of a storm, each once. */
const strikes = Arr.filter(
  Arr.dedupeWith(
    Arr.getSomes(Arr.makeBy(600 * 4, (quarter) => lastStrike(quarter / 4))),
    (a, b) => a.at === b.at
  ),
  (strike) => strike.at >= 0
);

describe("island/storm", () => {
  it("strikes about every eleven seconds, never two at once, between 400 m and 4 km away", () => {
    expect(strikes.length).toBeGreaterThan(40);
    expect(strikes.length).toBeLessThan(70);
    for (const [before, after] of Arr.zip(strikes, Arr.drop(strikes, 1))) {
      expect(after.at - before.at).toBeGreaterThan(1);
    }
    for (const strike of strikes) {
      expect(strike.distance).toBeGreaterThanOrEqual(400);
      expect(strike.distance).toBeLessThanOrEqual(4000);
    }
  });

  it("flashes as a stroke, a flicker and a return stroke, gone within half a second", () => {
    const strike = Option.getOrThrow(Arr.head(strikes));
    const at = (since: number) => flashOf(strike.at + since);
    expect(at(-0.01)).toBe(
      Option.match(lastStrike(strike.at - 0.01), {
        onNone: () => 0,
        onSome: () => at(-0.01),
      })
    );
    expect(at(0.03)).toBeGreaterThan(at(0.1));
    expect(at(0.15)).toBeGreaterThan(at(0.1));
    expect(at(0.6)).toBe(0);
  });

  it("lights the sky and the shade toward a cold white and leaves the sun alone", () => {
    const light = lightOf(14, "storm");
    const lit = flashed(light, 1);
    expect(lit.zenith[2]).toBeGreaterThan(light.zenith[2]);
    expect(lit.ambient[0]).toBeGreaterThan(light.ambient[0]);
    expect(lit.sun).toEqual(light.sun);
    expect(lit.horizon[2]).toBeGreaterThan(light.horizon[2]);
    expect(flashed(light, 0)).toEqual(light);
  });

  it("brings each thunder after its flash by the time sound takes to cross the distance", () => {
    const heard = thundersBetween(0, 600);
    expect(heard.length).toBeGreaterThan(40);
    // Every thunder heard is a strike's, after the time sound takes to cross its distance.
    for (const thunder of heard) {
      expect(
        Arr.some(
          Arr.getSomes(
            Arr.makeBy(612 * 4, (quarter) => lastStrike(quarter / 4 - 12))
          ),
          (strike) =>
            Math.abs(strike.at + strike.distance / 343 - thunder.at) < 1e-9
        )
      ).toBe(true);
    }
    // A near strike cracks louder and higher than a far one rolls.
    const near = Option.getOrThrow(
      Arr.head(Arr.filter(strikes, (s) => s.distance < 900))
    );
    const far = Option.getOrThrow(
      Arr.head(Arr.filter(strikes, (s) => s.distance > 3000))
    );
    const of = (s: typeof near) =>
      Option.getOrThrow(Arr.head(thundersBetween(s.at, s.at + 13)));
    expect(of(near).loud).toBeGreaterThan(of(far).loud);
    expect(of(near).rate).toBeGreaterThan(of(far).rate);
    expect(of(far).rate).toBeGreaterThanOrEqual(0.7);
    expect(of(near).loud).toBeLessThanOrEqual(1);
    // Each thunder is heard once across windows that touch.
    expect(
      thundersBetween(0, 300).length + thundersBetween(300, 600).length
    ).toBe(heard.length);
  });
});
