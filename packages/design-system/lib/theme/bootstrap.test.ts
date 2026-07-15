// @vitest-environment node

import vm from "node:vm";
import { createThemeBootstrapScript } from "@repo/design-system/lib/theme/bootstrap";
import {
  concreteThemeValues,
  themes,
} from "@repo/design-system/lib/theme/registry";
import { describe, expect, it } from "vitest";

interface BootstrapScenario {
  defaultTheme?: "light" | "system";
  matchMediaFails?: boolean;
  storageFails?: boolean;
  storedTheme?: string;
  systemDark?: boolean;
}

function runBootstrap({
  defaultTheme = "light",
  matchMediaFails = false,
  storageFails = false,
  storedTheme,
  systemDark = false,
}: BootstrapScenario = {}) {
  const classes = new Set(["font-variable", ...concreteThemeValues]);
  const style: { colorScheme?: string } = {};
  const script = createThemeBootstrapScript(defaultTheme);
  const context = {
    document: {
      documentElement: {
        classList: {
          add: (...values: string[]) => {
            for (const value of values) {
              classes.add(value);
            }
          },
          remove: (...values: string[]) => {
            for (const value of values) {
              classes.delete(value);
            }
          },
        },
        style,
      },
    },
    localStorage: {
      getItem: () => {
        if (storageFails) {
          throw new Error("Storage unavailable.");
        }
        return storedTheme ?? null;
      },
    },
    window: {
      matchMedia: () => {
        if (matchMediaFails) {
          throw new Error("Media query unavailable.");
        }
        return { matches: systemDark };
      },
    },
  };

  vm.runInNewContext(script, context);

  return { classes, colorScheme: style.colorScheme, script };
}

describe("theme bootstrap", () => {
  it("applies the official light default while preserving unrelated classes", () => {
    const result = runBootstrap();

    expect(result.classes).toEqual(new Set(["font-variable", "light"]));
    expect(result.colorScheme).toBe("light");
  });

  it("applies every persisted concrete theme with its owned appearance", () => {
    for (const theme of themes) {
      if (theme.appearance === "dynamic") {
        continue;
      }

      const result = runBootstrap({ storedTheme: theme.value });
      const expectedScheme = theme.appearance === "dark" ? "dark" : "light";

      expect(result.classes).toEqual(new Set(["font-variable", theme.value]));
      expect(result.colorScheme).toBe(expectedScheme);
    }
  });

  it("resolves persisted system state from the browser preference", () => {
    const light = runBootstrap({ storedTheme: "system" });
    const dark = runBootstrap({ storedTheme: "system", systemDark: true });

    expect(light.classes).toEqual(new Set(["font-variable", "light"]));
    expect(light.colorScheme).toBe("light");
    expect(dark.classes).toEqual(new Set(["font-variable", "dark"]));
    expect(dark.colorScheme).toBe("dark");
  });

  it("resolves a system first-visit default", () => {
    const result = runBootstrap({ defaultTheme: "system", systemDark: true });

    expect(result.classes).toEqual(new Set(["font-variable", "dark"]));
    expect(result.colorScheme).toBe("dark");
  });

  it("falls back safely when browser preference APIs are unavailable", () => {
    const storageFallback = runBootstrap({ storageFails: true });
    const mediaFallback = runBootstrap({
      matchMediaFails: true,
      storedTheme: "system",
    });

    expect(storageFallback.classes).toEqual(
      new Set(["font-variable", "light"])
    );
    expect(mediaFallback.classes).toEqual(new Set(["font-variable", "light"]));
  });

  it("mirrors next-themes for unknown persisted identifiers", () => {
    const result = runBootstrap({ storedTheme: "future-theme" });

    expect(result.classes).toEqual(new Set(["font-variable", "future-theme"]));
    expect(result.colorScheme).toBe("light");
  });

  it("emits deterministic inline-safe source", () => {
    const first = createThemeBootstrapScript();
    const second = createThemeBootstrapScript();

    expect(first).toBe(second);
    expect(first).not.toContain("</script");
  });
});
