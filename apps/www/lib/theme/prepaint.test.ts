import { afterEach, describe, expect, it } from "@effect/vitest";
import { THEME_STORAGE_KEY } from "@repo/design-system/lib/theme/registry";
import {
  connectThemeStore,
  createThemeStore,
} from "@repo/design-system/lib/theme/store";
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

/** Stands in for the prefers-color-scheme query that the script and the store both read. */
function stubSystemAppearance(prefersDark: boolean) {
  vi.stubGlobal("matchMedia", () =>
    Object.assign(new EventTarget(), { matches: prefersDark })
  );
}

/** Puts the page in the state the server sends, with the stored choice in storage. */
function resetPage(stored: string | null) {
  localStorage.clear();
  if (stored !== null) {
    localStorage.setItem(THEME_STORAGE_KEY, stored);
  }
  document.documentElement.removeAttribute("class");
  document.documentElement.style.removeProperty("color-scheme");
  document.head.replaceChildren();
}

/** The root class and color scheme that the page shows now. */
function readRoot() {
  const root = document.documentElement;
  return {
    classes: [...root.classList],
    colorScheme: root.style.getPropertyValue("color-scheme"),
  };
}

/** Paints the page with the inline script, as the server's HTML does before hydration. */
function paintWithScript() {
  new Function("window", "document", THEME_PREPAINT_SCRIPT)(window, document);
  return readRoot();
}

/** Paints the page with the theme store, as the provider does once the page hydrates. */
function paintWithStore() {
  const disconnect = connectThemeStore(createThemeStore());
  const painted = readRoot();
  disconnect();
  return painted;
}

describe("THEME_PREPAINT_SCRIPT and the theme store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetPage(null);
  });

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
    "paints the root as the store does for $stored when the system prefers dark is $prefersDark",
    ({ prefersDark, stored }) => {
      stubSystemAppearance(prefersDark);
      resetPage(stored);
      const scripted = paintWithScript();

      resetPage(stored);
      const applied = paintWithStore();

      expect(applied).toEqual(scripted);
    }
  );
});
