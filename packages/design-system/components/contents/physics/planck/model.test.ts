import { describe, expect, it } from "@effect/vitest";
import {
  evaluateBlackbody,
  sampleBlackbodySpectrum,
} from "@repo/design-system/components/contents/physics/planck/model";

describe("Planck blackbody model", () => {
  it("shifts peak wavelength shorter and photon energy higher as temperature rises", () => {
    const cool = evaluateBlackbody(3000);
    const hot = evaluateBlackbody(6000);

    expect(hot.peakWavelengthNm).toBeLessThan(cool.peakWavelengthNm);
    expect(hot.peakPhotonEv).toBeGreaterThan(cool.peakPhotonEv);
  });

  it("samples bounded Planck curve and diverging classical curve across UV-IR", () => {
    const defaultCurve = sampleBlackbodySpectrum(5000);
    const coldCurve = sampleBlackbodySpectrum(600, 4);

    expect(defaultCurve).toHaveLength(37);
    expect(coldCurve).toHaveLength(9);
    expect(defaultCurve[0]?.classical).toBeGreaterThan(
      defaultCurve[0]?.planck ?? 0
    );
  });
});
