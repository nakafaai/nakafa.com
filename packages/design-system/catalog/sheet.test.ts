// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import postcss from "postcss";
import { catalogSheet } from "#catalog/sheet";

const globals = `@import "tailwindcss";
@import "./identity.css";
@import "./allo.css";
@source "../../**/*.{ts,tsx}";
@custom-variant dark (&:is(.dark *));
:root {
  --background: oklch(1 0 0);
  --radius: 1rem;
  color-scheme: light;
}
.dark {
  --background: oklch(0.15 0.02 260);
  --radius: 1rem;
  color-scheme: dark;
}
@theme inline {
  --font-sans: "Allo", "Allo Fallback Arial", system-ui, sans-serif;
}
.geist-mono {
  --font-geist-mono: "Geist Mono Variable";
}
`;

describe("catalogSheet", () => {
  const sheet = catalogSheet(
    postcss.parse(globals),
    "/ds/styles",
    "/www/public/themes.css"
  );

  it("leaves the colors to the page and keeps the base radius and color scheme", () => {
    expect(sheet).not.toContain("--background");
    expect(sheet).toContain(
      ":root {\n  --radius: 1rem;\n  color-scheme: light;\n}"
    );
    expect(sheet).toContain(
      '[data-theme="dark"] {\n  --radius: 1rem;\n  color-scheme: dark;\n}'
    );
  });

  it("follows the page's dark theme attribute", () => {
    expect(sheet).toContain(
      '@custom-variant dark (&:is([data-theme="dark"] *));'
    );
  });

  it("reads its imports and classes from the design system by absolute path", () => {
    expect(sheet).toContain('@import "/ds/styles/identity.css";');
    expect(sheet).toContain('@source "/ds/styles/../components";');
    expect(sheet).toContain('@source "/ds/styles/../catalog";');
    expect(sheet).not.toContain("../../**");
  });

  it("brings every named theme's class along", () => {
    expect(sheet).toContain('@import "/www/public/themes.css";');
  });

  it("leaves Allo's faces to the page and names Allo and Geist Mono as it loads them", () => {
    expect(sheet).not.toContain("allo.css");
    expect(sheet).toContain(
      '--font-sans: "Allo", "Allo Fallback Arial", system-ui, sans-serif;'
    );
    expect(sheet).toContain('--font-geist-mono: "Geist Mono"');
  });
});
