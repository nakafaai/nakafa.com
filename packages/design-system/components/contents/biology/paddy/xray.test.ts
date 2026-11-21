// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  buryInSoil,
  XRAY,
  XRAY_GLOW,
  XRAY_GLSL,
  XRAY_VERTEX,
  xrayUniforms,
} from "@repo/design-system/components/contents/biology/paddy/xray";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import type { IUniform } from "three";
import { Color, MeshStandardMaterial } from "three";

describe("the paddy soil X-ray shader", () => {
  it("builds soil uniforms starting flooded with the paddy palette", () => {
    const uniforms = xrayUniforms();

    expect(uniforms.uFlood.value).toBe(1);
    expect(uniforms.uXrayDrained.value).toEqual(
      new Color(PADDY_COLORS.drained)
    );
    expect(uniforms.uXrayOxidised.value).toEqual(
      new Color(PADDY_COLORS.oxidised)
    );
    expect(uniforms.uXrayPan.value).toEqual(new Color(PADDY_COLORS.pan));
    expect(uniforms.uXrayReduced.value).toEqual(
      new Color(PADDY_COLORS.reduced)
    );
    expect(uniforms.uXrayReducedDark.value).toEqual(
      new Color(PADDY_COLORS.reducedDark)
    );
    expect(uniforms.uXraySubsoil.value).toEqual(
      new Color(PADDY_COLORS.subsoil)
    );
    expect(XRAY.radius).toBeGreaterThan(0);
    expect(XRAY_GLOW).toBeGreaterThan(1);
  });

  it("injects the soil attenuation shader and cache key on a material", () => {
    const uniforms = xrayUniforms();
    const real = new MeshStandardMaterial();
    buryInSoil(real, uniforms, "root");
    expect(real.customProgramCacheKey()).toBe("paddy-buried-root");

    const existingUniforms: Record<string, IUniform> = {
      existing: { value: 2 },
    };
    const shader = {
      fragmentShader: `#include <common>
#include <color_fragment>
#include <roughnessmap_fragment>
#include <normal_fragment_maps>
#include <emissivemap_fragment>
#include <lights_physical_fragment>`,
      uniforms: existingUniforms,
      vertexShader: "#include <common>\n#include <begin_vertex>",
    };
    const target = {
      customProgramCacheKey: () => "",
      onBeforeCompile: (_compiled: typeof shader) => {
        // Replaced by buryInSoil.
      },
    };

    buryInSoil(target, uniforms, "grain");
    expect(target.customProgramCacheKey()).toBe("paddy-buried-grain");

    target.onBeforeCompile(shader);

    expect(shader.uniforms.existing).toEqual({ value: 2 });
    expect(shader.uniforms.uFlood).toBe(uniforms.uFlood);
    expect(shader.vertexShader).toContain("varying vec3 vXray;");
    expect(shader.vertexShader).toContain(XRAY_VERTEX);
    expect(shader.fragmentShader).toContain(XRAY_GLSL);
    expect(shader.fragmentShader).toContain("vec4 buried = xraySoil(vXray);");
    expect(shader.fragmentShader).toContain(
      "roughnessFactor = mix(roughnessFactor, 1.0, buried.a);"
    );
    expect(shader.fragmentShader).toContain("totalEmissiveRadiance = mix(");
    expect(shader.fragmentShader).toContain(
      "material.clearcoat *= 1.0 - buried.a;"
    );
  });
});
