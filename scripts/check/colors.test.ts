import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import {
  inspectChromeColorSource,
  inspectColorSource,
} from "#scripts/check/colors";
import { parseSources } from "#scripts/check/source";

const VISUAL = "packages/design-system/components/contents/physics/lab.tsx";
const RENDERER =
  "apps/www/src/lib/content/renderer/client/base/visual/render.tsx";
const PAGE = "apps/www/src/components/home/header.tsx";
const COLOR_RULE =
  "color a plotted mark with PLOT_COLORS from @repo/design-system/lib/plot, a neutral surface with getColor from @repo/design-system/lib/color, and a real material such as asphalt, glass or a reagent with MATERIAL from @repo/design-system/lib/material, instead of a color written in place or a theme chart token";

/** Inspects one module with the color policy alone. */
function inspect(sourceText: string, file = VISUAL) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectColorSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Color source policy", () => {
  it.effect("rejects hex, CSS functions, and hex numbers in a visual", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
const ball = "#2563eb";
const glow = "rgba(37, 99, 235, 0.4)";
const mark = \`oklch(0.6 0.2 260)\`;
const light = 0xff0000;`),
        Arr.replicate(`${VISUAL}: ${COLOR_RULE}.`, 4)
      );
    })
  );

  it.effect("rejects a theme chart token as a variable or a class", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `
const series = { colors: { light: ["var(--chart-2)"] } };
const dot = "bg-chart-3 size-2";
const piece = \`var(--chart-\${(index % 5) + 1})\`;`,
          RENDERER
        ),
        Arr.replicate(`${RENDERER}: ${COLOR_RULE}.`, 3)
      );
    })
  );

  it.effect(
    "accepts the palette, neutrals, and numbers that are no colors",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
const mark = PLOT_COLORS.teal;
const ground = getColor("STONE", 600);
const mask = 0xff;
const anchor = "#section";`),
          []
        );
      })
  );

  it.effect("rejects a Tailwind color class in a visual", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `const tile = "rounded-md bg-teal-300 dark:bg-teal-500";`
        ),
        [`${VISUAL}: ${COLOR_RULE}.`]
      );
    })
  );

  it.effect("leaves pages outside the visual folders to their theme", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`const dot = "bg-chart-1 size-1";`, PAGE),
        []
      );
    })
  );

  it.effect("does not judge tests", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `const axis = "#dc2626";`,
          "packages/design-system/components/three/axes.test.ts"
        ),
        []
      );
    })
  );
});

const CHROME_RULE =
  "paint chrome with the theme's tokens, such as bg-background, text-foreground and bg-primary, or with an identity token of packages/design-system/styles/identity.css for a ground or an ink that every theme shares, instead of a color written in place";
const DIALOG = "packages/design-system/components/ui/dialog.tsx";
const CHART =
  "packages/design-system/components/evilcharts/charts/bar/paint.tsx";

/** Inspects one module with the chrome color policy alone. */
function inspectChrome(sourceText: string, file = PAGE) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectChromeColorSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Chrome color policy", () => {
  it.effect(
    "rejects a hex value, a color function, and a palette, white or black class in chrome",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectChrome(`
const hero = "bg-[#0f172a] p-4";
const glow = { boxShadow: "0 0 8px rgba(0, 0, 0, 0.2)" };
const ink = \`oklch(0.2 0.02 260)\`;
const badge = "rounded bg-amber-500";
const scrim = "fixed inset-0 bg-black/30";
const label = "text-white";`),
          Arr.replicate(`${PAGE}: ${CHROME_RULE}.`, 6)
        );
      })
  );

  it.effect(
    "rejects white or black as a whole paint value and inside a gradient",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectChrome(
            `
const fill = "white";
const fade = "linear-gradient(to bottom, black, transparent)";`,
            DIALOG
          ),
          Arr.replicate(`${DIALOG}: ${CHROME_RULE}.`, 2)
        );
      })
  );

  it.effect(
    "accepts theme tokens, identity tokens, a token mixed or derived, and text that is no color",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectChrome(`
const card = "bg-card text-card-foreground ring-foreground/10";
const scrim = "bg-ink/30 text-paper";
const tint = "bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))]";
const lift = "oklch(from var(--primary) calc(l + 0.1) c h)";
const wrap = "whitespace-nowrap";
const anchor = "#faq";
const issue = "nakafaai/nakafa.com#2423";
const entity = "&#169;";
const paint = "currentColor";`),
          []
        );
      })
  );

  it.effect(
    "accepts an attribute selector that names a library's default paint",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectChrome(
            `const grid = "[&_line[stroke='#ccc']]:stroke-border/50";`,
            DIALOG
          ),
          []
        );
      })
  );

  it.effect(
    "lets a mask say white and black, and judges any other color there",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectChrome(
            `
const shown = "white";
const hidden = "black";
const mask = "linear-gradient(white 0 0) content-box";
const mark = "#2563eb";`,
            CHART
          ),
          [`${CHART}: ${CHROME_RULE}.`]
        );
      })
  );

  it.effect(
    "leaves another owner's paint, lesson visuals and tests alone",
    () =>
      Effect.gen(function* () {
        for (const file of [
          "packages/design-system/components/logos/brand.tsx",
          "apps/www/src/components/shared/flag.tsx",
          "apps/www/src/components/shared/qr/image.tsx",
          VISUAL,
          "packages/design-system/components/ui/dialog.test.ts",
          "packages/design-system/lib/tile.ts",
        ]) {
          assert.deepStrictEqual(
            yield* inspectChrome(`const paint = "#ff0000";`, file),
            []
          );
        }
      })
  );
});
