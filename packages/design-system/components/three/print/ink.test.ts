// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { inkProgram } from "@repo/design-system/components/three/print/ink";
import { ShaderLib } from "three";

describe("laying ink on a standard material's program", () => {
  const standard = ShaderLib.physical.fragmentShader;
  const inked = inkProgram(standard);

  it("replaces the part that reads coverage in the renderer's own program", () => {
    expect(inked).not.toBe(standard);
    expect(inked).not.toContain("#include <alphamap_fragment>");
    expect(inked).toContain("texture2D( alphaMap, vAlphaMapUv, -1.0 )");
  });

  it("declares its uniforms before the program's body, once", () => {
    expect(inked.split("uniform vec3 printGround;")).toHaveLength(2);
    expect(inked.indexOf("uniform float printGlow;")).toBeLessThan(
      inked.indexOf("void main() {")
    );
  });

  it("adds a display's own light after the material's, keeping the material's part", () => {
    expect(inked.split("#include <emissivemap_fragment>")).toHaveLength(2);
    expect(inked.indexOf("#include <emissivemap_fragment>")).toBeLessThan(
      inked.indexOf("totalEmissiveRadiance += diffuseColor.rgb * printGlow;")
    );
  });

  it("leaves a program that lacks one of those parts as it is", () => {
    const other = "void main() {\n#include <alphamap_fragment>\n}";
    expect(inkProgram(other)).toBe(other);
    expect(inkProgram("precision highp float;")).toBe("precision highp float;");
  });
});
