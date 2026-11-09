import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectColorSource } from "#scripts/check/colors";
import { parseSources } from "#scripts/check/source";

const VISUAL = "packages/design-system/components/contents/physics/lab.tsx";
const RENDERER =
  "apps/www/src/lib/content/renderer/client/base/visual/render.tsx";
const PAGE = "apps/www/src/components/home/header.tsx";
const COLOR_RULE =
  "color a plotted mark with PLOT_COLORS from @repo/design-system/lib/plot and a neutral surface with getColor from @repo/design-system/lib/color, instead of a color written in place or a theme chart token";

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
