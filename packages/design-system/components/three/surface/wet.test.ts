import { describe, expect, it } from "@effect/vitest";
import { wetLook } from "@repo/design-system/components/three/surface/wet";

describe("wetLook", () => {
  it("leaves a dry surface opaque and uncoated on every device", () => {
    expect(wetLook(false, true)).toEqual(wetLook(false, false));
    expect(wetLook(false, true)).toMatchObject({
      opacity: 1,
      smooth: 1,
      transmission: 0,
      transparent: false,
      varnish: 0,
    });
  });

  it("passes light through wet tissue where the device can afford it", () => {
    const look = wetLook(true, true);
    expect(look.transmission).toBeGreaterThan(0);
    expect(look.thickness).toBeGreaterThan(0);
    expect(look.transparent).toBe(false);
    expect(look.opacity).toBe(1);
  });

  it("keeps wet tissue wet without the extra pass on a phone", () => {
    const look = wetLook(true, false);
    expect(look.transmission).toBe(0);
    expect(look.transparent).toBe(true);
    expect(look.opacity).toBeLessThan(1);
    expect(look.varnish).toBe(1);
    expect(look.smooth).toBeLessThan(1);
    expect(look.sheen).toBeGreaterThan(0);
  });
});
