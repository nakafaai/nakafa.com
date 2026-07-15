// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
  toRgbProjection,
} from "@repo/design-system/lib/theme/contract";
import {
  getThemeAppearance,
  getThemeShaderColor,
  themes,
} from "@repo/design-system/lib/theme/registry";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const sources = await Effect.runPromise(
  readThemeStyleSources().pipe(Effect.provide(NodeFileSystem.layer))
);

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
