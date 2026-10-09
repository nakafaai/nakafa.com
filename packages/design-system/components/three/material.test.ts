import { describe, expect, it } from "@effect/vitest";
import { tintMaterial } from "@repo/design-system/components/three/material";
import { Color, Material, MeshStandardMaterial } from "three";

describe("tintMaterial", () => {
  it("returns a tinted clone and leaves the source material unchanged", () => {
    const source = new MeshStandardMaterial({ color: "#ffffff" });

    const tinted = tintMaterial(source, "#ff0000");

    expect(tinted).not.toBe(source);
    expect(tinted).toMatchObject({ color: new Color("#ff0000") });
    expect(source.color.getHexString()).toBe("ffffff");
  });

  it("tints every material of a multi-material mesh", () => {
    const first = new MeshStandardMaterial({ color: "#ffffff" });
    const second = new MeshStandardMaterial({ color: "#000000" });

    const tinted = tintMaterial([first, second], "#00ff00");

    expect(tinted).toMatchObject([
      { color: new Color("#00ff00") },
      { color: new Color("#00ff00") },
    ]);
  });

  it("clones a material without a color property and adds none", () => {
    const tinted = tintMaterial(new Material(), "#ff0000");

    expect(tinted).not.toHaveProperty("color");
  });
});
