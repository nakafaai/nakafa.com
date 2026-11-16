// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import postcss from "postcss";
import { themesSection } from "#catalog/themes";

const sheet = postcss.parse(`/* The themes. */
.ocean {
  --background: oklch(0.98 0.01 230);
  --foreground: oklch(0.2 0.03 240);
  --primary: oklch(0.5 0.15 230);
  --accent: oklch(0.9 0.04 230);
  color-scheme: light;
}
:root {
  --background: white;
}
.night {
  /* The ground. */
  --background: oklch(0.15 0.02 260);
  color-scheme: dark;
}
@media (min-width: 1px) {
  .x { color: red; }
}
`);

describe("themesSection", () => {
  const text = themesSection(sheet);

  it("lists every named theme with its appearance and the colors that set it apart", () => {
    expect(text).toContain("A learner picks one of 2 named themes");
    expect(text).toContain(
      "| `ocean` | light | `oklch(0.98 0.01 230)` | `oklch(0.2 0.03 240)` | `oklch(0.5 0.15 230)` | `oklch(0.9 0.04 230)` |"
    );
  });

  it("leaves a cell empty where a theme declares no such color", () => {
    expect(text).toContain(
      "| `night` | dark | `oklch(0.15 0.02 260)` |  |  |  |"
    );
  });

  it("reads only the theme classes at the top of the sheet", () => {
    expect(text).not.toContain("`x`");
  });
});
