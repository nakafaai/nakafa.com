import { describe, expect, it } from "@effect/vitest";

import { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";

describe("getAtomSceneColors", () => {
  it("uses the light palette and dark label text on the light theme", () => {
    const colors = getAtomSceneColors("light");

    expect(colors.carbon).toEqual(getColor("STONE"));
    expect(colors.text).toEqual(ORIGIN_COLOR.DARK);
    expect(colors.sphereText).toEqual(ORIGIN_COLOR.LIGHT);
  });

  it("uses the dark palette and light label text on the dark theme", () => {
    const colors = getAtomSceneColors("dark");

    expect(colors.carbon).toEqual(getColor("ZINC"));
    expect(colors.text).toEqual(ORIGIN_COLOR.LIGHT);
    expect(colors.sphereTextOutline).toEqual(ORIGIN_COLOR.DARK);
  });
});
