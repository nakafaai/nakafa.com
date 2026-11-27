import { describe, expect, it } from "@effect/vitest";
import { matterLook } from "@repo/design-system/components/three/matter/recipe";
import { MATTER_COLORS } from "@repo/design-system/lib/material/matter";
import { Option } from "effect";
import {
  AdditiveBlending,
  CustomBlending,
  DoubleSide,
  FrontSide,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
} from "three";

describe("matterLook", () => {
  it("makes brass bare machined metal in its measured colour", () => {
    const brass = matterLook({ of: "brass" });

    expect(brass.color).toBe(MATTER_COLORS.brass);
    expect(brass.metalness).toBe(1);
    expect(brass.surface).toStrictEqual(Option.some("machined"));
    expect(brass.relief).toBeGreaterThan(0);
    expect(brass.emissiveIntensity).toBe(0);
    expect(brass.transparent).toBe(false);
    expect(brass.depthWrite).toBe(true);
  });

  it("works a metal to the finish its author names", () => {
    expect(
      matterLook({ finish: "knurled", of: "brass" }).surface
    ).toStrictEqual(Option.some("knurl"));
    expect(matterLook({ of: "iron" }).surface).toStrictEqual(
      Option.some("cast")
    );
  });

  it("lays a finer tile on knurling than on a plank of oak", () => {
    const knurl = matterLook({ finish: "knurled", of: "brass" });
    const oak = matterLook({ of: "oak" });

    expect(oak.tile).toBeCloseTo(1 / 2.8);
    expect(knurl.tile).toBeLessThan(oak.tile);
  });

  it("winds copper as magnet wire under clear enamel", () => {
    const coil = matterLook({ finish: "wound", of: "copper" });

    expect(coil.surface).toStrictEqual(Option.some("winding"));
    expect(coil.clearcoat).toBeGreaterThan(0.5);
    expect(matterLook({ of: "copper" }).clearcoat).toBe(0);
  });

  it("keeps the same surface for a material in every lab", () => {
    expect(matterLook({ of: "oak" }).surface).toBe(
      matterLook({ of: "oak" }).surface
    );
  });

  it("heats tungsten from dark through red to white, brighter the hotter it runs", () => {
    const cold = matterLook({ of: "tungsten" });
    const dull = matterLook({ glow: 0.3, of: "tungsten" });
    const white = matterLook({ glow: 1, of: "tungsten" });

    expect(cold.emissiveIntensity).toBe(0);
    expect(cold.color).toBe(MATTER_COLORS.tungsten);
    expect(white.color).toBe(MATTER_COLORS.dark);
    expect(dull.emissiveIntensity).toBeGreaterThan(0);
    expect(white.emissiveIntensity).toBeGreaterThan(dull.emissiveIntensity * 5);
    expect(white.emissive).toBe(MATTER_COLORS.heatWhite);
    expect(dull.emissive).not.toBe(white.emissive);
    expect(matterLook({ glow: 0, of: "tungsten" }).emissive).toBe(
      MATTER_COLORS.heatRed
    );
  });

  it("never runs nichrome as hot as a filament, and holds a glow to its range", () => {
    const element = matterLook({ glow: 1, of: "nichrome" });
    const filament = matterLook({ glow: 1, of: "tungsten" });

    expect(element.emissiveIntensity).toBeLessThan(filament.emissiveIntensity);
    expect(element.emissive).not.toBe(MATTER_COLORS.heatWhite);
    expect(matterLook({ glow: 4, of: "nichrome" })).toStrictEqual(element);
    expect(matterLook({ glow: -1, of: "nichrome" }).emissiveIntensity).toBe(0);
  });

  it("paints what is painted in the colour it is given", () => {
    const enamel = matterLook({ color: "#c62828", of: "enamel" });
    const paint = matterLook({ color: "#c62828", of: "paint" });

    expect(enamel.color).toBe("#c62828");
    expect(enamel.metalness).toBe(0);
    expect(enamel.clearcoat).toBeGreaterThan(paint.clearcoat);
    expect(paint.roughness).toBeGreaterThan(enamel.roughness);
  });

  it("gives a wood its own colour until a stain replaces it", () => {
    expect(matterLook({ of: "walnut" }).color).toBe(MATTER_COLORS.walnut);
    expect(matterLook({ color: "#3a2416", of: "walnut" }).color).toBe(
      "#3a2416"
    );
  });

  it("lights an indicator in its own colour", () => {
    const lit = matterLook({ color: "#30d158", glow: 1, of: "epoxy" });

    expect(lit.emissive).toBe("#30d158");
    expect(lit.emissiveIntensity).toBeGreaterThan(1);
    expect(
      matterLook({ color: "#30d158", of: "epoxy" }).emissiveIntensity
    ).toBe(0);
  });

  it("lets a moulded part through where its author makes it translucent", () => {
    const shade = matterLook({ color: "#ffffff", of: "plastic", opacity: 0.6 });

    expect(shade.transparent).toBe(true);
    expect(shade.depthWrite).toBe(false);
    expect(shade.opacity).toBe(0.6);
  });

  it("makes glass a clear pane seen from both sides, with no relief", () => {
    const glass = matterLook({ of: "glass" });

    expect(glass.surface).toStrictEqual(Option.none());
    expect(glass.relief).toBe(0);
    expect(glass.transparent).toBe(true);
    expect(glass.depthWrite).toBe(false);
    expect(glass.side).toBe(DoubleSide);
    expect(glass.ior).toBe(1.473);
    expect(glass.transmission).toBe(0);
    expect(matterLook({ of: "glass", opacity: 0.4 }).opacity).toBe(0.4);
  });

  it("mirrors the room in a clear pane in full, however clear the pane is", () => {
    const pane = matterLook({ color: "#ffffff", of: "glass", opacity: 0.5 });
    const solid = matterLook({ color: "#ffffff", of: "glass", opacity: 1 });

    expect(pane.blending).toBe(CustomBlending);
    expect(pane.blendSrc).toBe(OneFactor);
    expect(pane.blendDst).toBe(OneMinusSrcAlphaFactor);
    expect(pane.color).toBe("#bcbcbc");
    expect(solid.blending).toBe(NormalBlending);
    expect(solid.blendSrc).toBe(SrcAlphaFactor);
    expect(solid.color).toBe("#ffffff");
    expect(matterLook({ of: "oak" }).blendSrc).toBe(SrcAlphaFactor);
  });

  it("fades a clear pane as a whole on a stage that draws straight to the screen", () => {
    const ask = {
      color: "#ffffff",
      glow: 1,
      of: "glass",
      opacity: 0.5,
    } as const;
    const pane = matterLook(ask, true);
    const halo = matterLook(
      { color: "#ffd68a", of: "light", opacity: 0.2 },
      true
    );

    expect(pane.blending).toBe(NormalBlending);
    expect(pane.blendSrc).toBe(SrcAlphaFactor);
    expect(pane.color).toBe("#ffffff");
    expect(pane.opacity).toBe(0.5);
    expect(pane.emissiveIntensity).toBe(matterLook(ask).emissiveIntensity * 2);
    expect(halo.blending).toBe(AdditiveBlending);
    expect(matterLook({ of: "brass" }, true)).toStrictEqual(
      matterLook({ of: "brass" })
    );
  });

  it("shows as much of a glowing pane's light as of the pane", () => {
    const pane = matterLook({
      color: "#ffd68a",
      glow: 1,
      of: "glass",
      opacity: 0.5,
    });
    const solid = matterLook({
      color: "#ffd68a",
      glow: 1,
      of: "glass",
      opacity: 1,
    });

    expect(pane.emissive).toBe("#ffd68a");
    expect(pane.emissiveIntensity).toBeCloseTo(solid.emissiveIntensity / 2);
  });

  it("varnishes lacquered wood to a harder shine than oiled wood", () => {
    const lacquer = matterLook({ color: "#1565c0", of: "lacquer" });
    const oiled = matterLook({ of: "walnut" });

    expect(lacquer.surface).toStrictEqual(Option.some("wood"));
    expect(lacquer.clearcoat).toBeGreaterThan(oiled.clearcoat);
    expect(lacquer.clearcoatRoughness).toBeLessThan(oiled.clearcoatRoughness);
    expect(oiled.clearcoat).toBeGreaterThan(0.3);
  });

  it("gives wood a grain that follows the part, and nothing else one", () => {
    expect(matterLook({ of: "oak" }).grain).toBe(true);
    expect(matterLook({ color: "#1565c0", of: "lacquer" }).grain).toBe(true);
    expect(matterLook({ of: "brass" }).grain).toBe(false);
    expect(matterLook({ of: "glass" }).grain).toBe(false);
  });

  it("bends the scene through a thick glass wall instead of fading it", () => {
    const wall = matterLook({ of: "glass", thickness: 0.02 });

    expect(wall.transmission).toBe(1);
    expect(wall.thickness).toBe(0.02);
    expect(wall.opacity).toBe(1);
    expect(wall.transparent).toBe(false);
    expect(wall.attenuationDistance).toBeCloseTo(0.8);
    expect(wall.attenuationColor).toBe(MATTER_COLORS.glassEdge);
  });

  it("fills a vessel with a dyed liquid seen from outside", () => {
    const liquid = matterLook({ color: "#2f8fe0", of: "liquid" });

    expect(
      matterLook({ color: "#2f8fe0", of: "liquid", opacity: 1 }).color
    ).toBe("#2f8fe0");
    expect(liquid.color).not.toBe("#2f8fe0");
    expect(liquid.side).toBe(FrontSide);
    expect(liquid.ior).toBe(1.33);
    expect(liquid.opacity).toBeGreaterThan(matterLook({ of: "glass" }).opacity);
  });

  it("makes mercury an opaque liquid mirror", () => {
    const mercury = matterLook({ of: "mercury" });

    expect(mercury.metalness).toBe(1);
    expect(mercury.transparent).toBe(false);
    expect(mercury.depthWrite).toBe(true);
    expect(mercury.surface).toStrictEqual(Option.none());
  });

  it("draws light as something that only shines and reflects nothing", () => {
    const beam = matterLook({ color: "#ffd68a", of: "light" });
    const halo = matterLook({ color: "#ffd68a", of: "light", opacity: 0.2 });
    const dim = matterLook({ color: "#ffd68a", glow: 0.25, of: "light" });

    expect(beam.color).toBe(MATTER_COLORS.dark);
    expect(beam.emissive).toBe("#ffd68a");
    expect(beam.specularIntensity).toBe(0);
    expect(beam.blending).toBe(NormalBlending);
    expect(halo.blending).toBe(AdditiveBlending);
    expect(halo.transparent).toBe(true);
    expect(dim.emissiveIntensity).toBe(beam.emissiveIntensity / 4);
    expect(halo.blendSrc).toBe(SrcAlphaFactor);
  });
});
