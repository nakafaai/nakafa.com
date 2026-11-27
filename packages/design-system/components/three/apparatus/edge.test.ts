// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { edgeProgram } from "@repo/design-system/components/three/apparatus/edge";
import { ShaderLib } from "three";

describe("showing the thickness of glass in a physical material's program", () => {
  const physical = ShaderLib.physical.fragmentShader;
  const edged = edgeProgram(physical);

  it("thickens the glass after the material's own colour is read, in the renderer's own program", () => {
    expect(edged).not.toBe(physical);
    expect(edged.split("#include <color_fragment>")).toHaveLength(2);
    expect(edged.indexOf("#include <color_fragment>")).toBeLessThan(
      edged.indexOf("diffuseColor.a = mix( diffuseColor.a")
    );
  });

  it("declares its uniform before the program's body, once", () => {
    expect(edged.split("uniform vec3 edgeTint;")).toHaveLength(2);
    expect(edged.indexOf("uniform vec3 edgeTint;")).toBeLessThan(
      edged.indexOf("void main() {")
    );
  });

  it("leaves a program that lacks one of those parts as it is", () => {
    const other = "void main() {\n}";
    expect(edgeProgram(other)).toBe(other);
    expect(edgeProgram("#include <color_fragment>")).toBe(
      "#include <color_fragment>"
    );
  });
});
