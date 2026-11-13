import { describe, expect, it } from "@effect/vitest";
import {
  EARTH_GM,
  orbitMotion,
} from "@repo/design-system/components/contents/physics/kinematics/orbit/satellite";

describe("orbitMotion", () => {
  it("circles the space station at about 7.67 km/s every 92.4 minutes", () => {
    const station = orbitMotion("station");
    expect(station.speed / 1000).toBeCloseTo(7.67, 2);
    expect(station.period / 60).toBeCloseTo(92.4, 1);
    expect(station.acceleration).toBeCloseTo(8.69, 2);
  });

  it("turns a geostationary satellite once a sidereal day, 23 h 56 min", () => {
    expect(orbitMotion("geostationary").period / 3600).toBeCloseTo(23.93, 2);
  });

  it("makes the centripetal acceleration equal gravity there, GM / r squared", () => {
    const gps = orbitMotion("gps");
    expect(gps.acceleration).toBeCloseTo(EARTH_GM / gps.radius ** 2);
    expect(gps.period / 3600).toBeCloseTo(11.97, 1);
  });
});
