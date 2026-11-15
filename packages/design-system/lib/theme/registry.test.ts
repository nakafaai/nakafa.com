// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_THEME,
  getThemeAppearance,
  parseThemeChoice,
  resolveThemeChoice,
  themes,
} from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Option } from "effect";

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
