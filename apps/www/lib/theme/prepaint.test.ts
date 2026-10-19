import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
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
