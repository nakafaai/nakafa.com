import { describe, expect, it } from "@effect/vitest";
import {
  getThemeAppearance,
  parseThemeChoice,
  resolveThemeChoice,
} from "@repo/design-system/lib/theme/registry";
import { Option, Schema } from "effect";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";

const PaintCase = Schema.Struct({
  prefersDark: Schema.Boolean,
  stored: Schema.NullOr(Schema.String),
});

/** Runs the inline script against fake browser globals and returns what it applied. */
function runPrepaint({ prefersDark, stored }: typeof PaintCase.Type) {
  let classes: readonly string[] = [];
  let colorScheme: string | undefined;
  const fakeWindow = {
    localStorage: {
      getItem: () => {
        if (stored === "blocked") {
          throw new Error("storage is blocked");
        }
        return stored;
      },
    },
    matchMedia: () => ({ matches: prefersDark }),
  };
  const fakeDocument = {
    documentElement: {
      classList: {
        add: (name: string) => {
          classes = [...classes, name];
        },
      },
      style: {
        set colorScheme(value: string) {
          colorScheme = value;
        },
      },
    },
  };
  new Function("window", "document", THEME_PREPAINT_SCRIPT)(
    fakeWindow,
    fakeDocument
  );
  return { classes, colorScheme };
}

describe("THEME_PREPAINT_SCRIPT", () => {
  it("applies a stored concrete theme with its appearance", () => {
    expect(runPrepaint({ prefersDark: false, stored: "dark" })).toEqual({
      classes: ["dark"],
      colorScheme: "dark",
    });
  });

  it("keeps a light theme light when the system prefers dark", () => {
    expect(runPrepaint({ prefersDark: true, stored: "light" })).toEqual({
      classes: ["light"],
      colorScheme: "light",
    });
  });

  it("resolves the system value and a missing value to the system appearance", () => {
    expect(runPrepaint({ prefersDark: true, stored: "system" })).toEqual({
      classes: ["dark"],
      colorScheme: "dark",
    });
    expect(runPrepaint({ prefersDark: false, stored: null })).toEqual({
      classes: ["light"],
      colorScheme: "light",
    });
  });

  it("falls back to the system appearance for an unknown value", () => {
    expect(runPrepaint({ prefersDark: true, stored: "unknown" })).toEqual({
      classes: ["dark"],
      colorScheme: "dark",
    });
  });

  it("falls back to the system appearance when storage is blocked", () => {
    expect(runPrepaint({ prefersDark: true, stored: "blocked" })).toEqual({
      classes: ["dark"],
      colorScheme: "dark",
    });
  });
});

/** The root class and color scheme that the theme store writes for a stored value. */
function storeResolution({ prefersDark, stored }: typeof PaintCase.Type) {
  const choice = parseThemeChoice(Option.fromNullishOr(stored));
  const resolved = resolveThemeChoice(choice, prefersDark ? "dark" : "light");
  return { classes: [resolved], colorScheme: getThemeAppearance(resolved) };
}

describe("THEME_PREPAINT_SCRIPT and the theme store", () => {
  it.each([
    { prefersDark: false, stored: null },
    { prefersDark: true, stored: null },
    { prefersDark: false, stored: "system" },
    { prefersDark: true, stored: "system" },
    { prefersDark: true, stored: "dark" },
    { prefersDark: false, stored: "darkmatter" },
    { prefersDark: true, stored: "bean" },
    { prefersDark: true, stored: "unknown" },
  ])(
    "applies what the store applies for $stored when the system prefers dark is $prefersDark",
    (paintCase) => {
      expect(runPrepaint(paintCase)).toEqual(storeResolution(paintCase));
    }
  );
});
