// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import {
  getThemeAppearance,
  getThemeShaderColor,
  themes,
} from "@repo/design-system/lib/theme";
import Color from "colorjs.io";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
  toRgbProjection,
} from "./theme-contract";

const sources = await Effect.runPromise(
  readThemeStyleSources().pipe(Effect.provide(NodeFileSystem.layer))
);
const STATUS_COLOR_FAMILIES = {
  "--destructive": { maximumHue: 35, minimumChroma: 0.1, minimumHue: 0 },
  "--info": { maximumHue: 260, minimumChroma: 0.1, minimumHue: 200 },
  "--success": { maximumHue: 190, minimumChroma: 0.1, minimumHue: 145 },
  "--warning": { maximumHue: 100, minimumChroma: 0.1, minimumHue: 65 },
} as const;

describe("theme registry", () => {
  it("defines every selectable theme exactly once", () => {
    const values = themes.map((theme) => theme.value);

    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("darkmatter");
  });

  it("keeps system dynamic and every concrete theme explicit", () => {
    const dynamicThemes = themes.filter(
      (theme) => theme.appearance === "dynamic"
    );
    const darkThemes = themes.filter((theme) => theme.appearance === "dark");

    expect(dynamicThemes.map((theme) => theme.value)).toEqual(["system"]);
    expect(darkThemes.map((theme) => theme.value)).toEqual(["dark"]);
  });

  it("derives every shader color from its profile primary", () => {
    for (const theme of themes) {
      const profileName = theme.value === "system" ? "light" : theme.value;
      const profile = createThemeProfiles([profileName], sources)[0];
      expect(profile, `${theme.value} must resolve to a profile`).toBeDefined();
      if (!profile) {
        continue;
      }

      const rule = findTopLevelRule(profile.root, profile.selector);
      expect(
        rule,
        `${profile.name} must declare ${profile.selector}`
      ).toBeDefined();
      if (!rule) {
        continue;
      }

      const primary = readDirectValue(rule, "--primary");
      expect(primary, `${profile.name} must declare --primary`).toBeDefined();
      if (!primary) {
        continue;
      }

      expect(theme.shaderColor).toBe(toRgbProjection(primary));
    }
  });

  it("keeps status colors in stable semantic hue families", () => {
    const profileNames = themes.flatMap((theme) =>
      theme.appearance === "dynamic" ? [] : [theme.value]
    );

    for (const profile of createThemeProfiles(profileNames, sources)) {
      const rule = findTopLevelRule(profile.root, profile.selector);
      expect(rule).toBeDefined();
      if (!rule) {
        continue;
      }

      for (const [token, family] of Object.entries(STATUS_COLOR_FAMILIES)) {
        const value = readDirectValue(rule, token);
        expect(value).toBeDefined();
        if (!value) {
          continue;
        }

        const [, chroma, hue] = new Color(value).to("oklch").coords;
        expect(Number(chroma)).toBeGreaterThanOrEqual(family.minimumChroma);
        expect(Number(hue)).toBeGreaterThanOrEqual(family.minimumHue);
        expect(Number(hue)).toBeLessThanOrEqual(family.maximumHue);
      }
    }
  });
});

describe("getThemeAppearance", () => {
  it("resolves the official dark theme to dark", () => {
    expect(getThemeAppearance("dark")).toBe("dark");
  });

  it.each([
    "light",
    "darkmatter",
    "cosmic",
    "system",
    undefined,
    "unknown",
  ])("resolves %s to the light default", (theme) => {
    expect(getThemeAppearance(theme)).toBe("light");
  });
});

describe("getThemeShaderColor", () => {
  it.each(themes)("returns the registered projection for $value", (theme) => {
    expect(getThemeShaderColor(theme.value)).toBe(theme.shaderColor);
  });

  it("maps system preference to the official light projection", () => {
    expect(getThemeShaderColor("system")).toBe(getThemeShaderColor("light"));
  });

  it.each([
    undefined,
    "unknown",
  ])("falls back to the official light projection for %s", (theme) => {
    expect(getThemeShaderColor(theme)).toBe(getThemeShaderColor("light"));
  });
});
