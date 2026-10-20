// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_THEME,
  getThemeAppearance,
  getThemeShaderAlphaColor,
  getThemeShaderColor,
  parseThemeChoice,
  resolveThemeChoice,
  themes,
} from "@repo/design-system/lib/theme/registry";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
  toRgbProjection,
} from "@repo/design-system/test/contract";
import { Array as Arr, Effect, Option } from "effect";

const readSources = readThemeStyleSources().pipe(
  Effect.provide(NodeFileSystem.layer)
);

describe("theme registry", () => {
  it("uses the browser preference for first-time visitors", () => {
    expect(DEFAULT_THEME).toBe("system");
  });

  it("defines every selectable theme exactly once", () => {
    const values = Arr.map(themes, (theme) => theme.value);

    expect(Arr.dedupe(values).length).toBe(values.length);
    expect(values).toContain("darkmatter");
  });

  it("keeps system dynamic and every concrete theme explicit", () => {
    const dynamicThemes = Arr.filter(
      themes,
      (theme) => theme.appearance === "dynamic"
    );
    const darkThemes = Arr.filter(
      themes,
      (theme) => theme.appearance === "dark"
    );

    expect(Arr.map(dynamicThemes, (theme) => theme.value)).toEqual(["system"]);
    expect(Arr.map(darkThemes, (theme) => theme.value)).toEqual(["dark"]);
  });

  it.effect("derives every shader color from its profile primary", () =>
    Effect.gen(function* () {
      const sources = yield* readSources;

      for (const theme of themes) {
        const profileName = theme.value === "system" ? "light" : theme.value;
        const profile = createThemeProfiles([profileName], sources)[0];
        expect(
          profile,
          `${theme.value} must resolve to a profile`
        ).toBeDefined();
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

        expect(theme.shaderColor).toBe(yield* toRgbProjection(primary));
      }
    })
  );
});

describe("getThemeAppearance", () => {
  it("resolves the official dark theme to dark", () => {
    expect(getThemeAppearance("dark")).toBe("dark");
  });

  it.each(["light", "darkmatter", "cosmic", "system", undefined, "unknown"])(
    "resolves %s to the light default",
    (theme) => {
      expect(getThemeAppearance(theme)).toBe("light");
    }
  );
});

describe("getThemeShaderColor", () => {
  it.each(themes)("returns the registered projection for $value", (theme) => {
    expect(getThemeShaderColor(theme.value)).toBe(theme.shaderColor);
  });

  it("maps system preference to the official light projection", () => {
    expect(getThemeShaderColor("system")).toBe(getThemeShaderColor("light"));
  });

  it.each([undefined, "unknown"])(
    "falls back to the official light projection for %s",
    (theme) => {
      expect(getThemeShaderColor(theme)).toBe(getThemeShaderColor("light"));
    }
  );
});

describe("getThemeShaderAlphaColor", () => {
  it.each(themes)("applies the alpha to the $value projection", (theme) => {
    const projected = theme.shaderColor
      .replace("rgb(", "rgba(")
      .replace(")", ", 0.4)");

    expect(getThemeShaderAlphaColor(theme.shaderColor, 0.4)).toBe(projected);
  });

  it("keeps the registered channels for every alpha", () => {
    const color = getThemeShaderColor("dark");

    expect(getThemeShaderAlphaColor(color, 0.32)).toBe(
      "rgba(57, 199, 244, 0.32)"
    );
  });
});

describe("parseThemeChoice", () => {
  it("reads a stored theme or the system choice as itself", () => {
    expect(parseThemeChoice(Option.some("dark"))).toBe("dark");
    expect(parseThemeChoice(Option.some("system"))).toBe("system");
  });

  it("resolves a missing value and a value that names no theme to the default choice", () => {
    expect(parseThemeChoice(Option.none())).toBe(DEFAULT_THEME);
    expect(parseThemeChoice(Option.some("unknown"))).toBe(DEFAULT_THEME);
  });
});

describe("resolveThemeChoice", () => {
  it("shows the system appearance for the system choice", () => {
    expect(resolveThemeChoice("system", "dark")).toBe("dark");
    expect(resolveThemeChoice("system", "light")).toBe("light");
  });

  it("shows a named theme as itself, whatever the system appearance", () => {
    expect(resolveThemeChoice("bean", "dark")).toBe("bean");
  });
});
